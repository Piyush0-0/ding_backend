const express = require("express");
const router = express.Router();
const db = require("../db");
const {
  authenticateUser,
  optionalAuthenticateUser,
} = require("../middlewares/authenticateUser");
const { createRoutedPayment } = require('../services/razorpay');

router.get("/:orderId", authenticateUser, async (req, res) => {
  const { userId } = req.user;
  const { orderId } = req.params;

  if (!orderId) {
    return res.status(400).json({ error: "Order ID is required." });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Fetch order details
    const query = `
      SELECT o.id AS order_id, o.total_amount, o.order_status, r.merchant_vpa, r.merchant_name, r.payment_acceptance_type as order_type
      FROM Orders o
      JOIN Restaurants r ON o.restaurant_id = r.id
      WHERE o.id = ? AND o.user_id = ?;
    `;
    const [orderRows] = await connection.query(query, [orderId, userId]);
    const order = orderRows[0]; // Get the first item from the array

    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: "Order not found or does not belong to the user." });
    }

    // If the total amount is invalid, try to calculate it from order items
    if (!order.total_amount || order.total_amount <= 0 || isNaN(order.total_amount)) {
      console.warn("Invalid total amount in database, calculating from order items");
      
      // Calculate total amount from order items
      const itemsQuery = `
        SELECT SUM(price * quantity) as total_amount
        FROM OrderItems
        WHERE order_id = ?
      `;
      const [itemsResult] = await connection.query(itemsQuery, [orderId]);
      const calculatedTotal = itemsResult[0]?.total_amount || 0;
      
      if (calculatedTotal > 0) {
        order.total_amount = calculatedTotal;
        
        // Update the order with the correct total amount
        await connection.query(
          `UPDATE Orders SET total_amount = ? WHERE id = ?`,
          [calculatedTotal, orderId]
        );
      } else {
        await connection.rollback();
        return res.status(400).json({ error: "Invalid order amount. No valid items found." });
      }
    }
    
    // Validate order amount
    if (!order.total_amount || order.total_amount <= 0) {
      // Try to fix malformed total amount if it's a string
      if (typeof order.total_amount === 'string') {
        const totalAmountStr = order.total_amount.toString();
        
        // Check if it's a malformed number (contains multiple decimal points)
        if (totalAmountStr.includes('.') && totalAmountStr.split('.').length > 2) {
          console.warn("Malformed total amount detected in payments API:", totalAmountStr);
          
          // Try to extract the first number before the second decimal point
          const parts = totalAmountStr.split('.');
          if (parts.length >= 2) {
            const firstPart = parts[0];
            const secondPart = parts[1].substring(0, 2); // Take only 2 decimal places
            const fixedAmount = parseFloat(`${firstPart}.${secondPart}`);
            
            if (!isNaN(fixedAmount) && fixedAmount > 0) {
              order.total_amount = fixedAmount;
              
              // Update the order with the fixed amount
              await connection.query(
                `UPDATE Orders SET total_amount = ? WHERE id = ?`,
                [fixedAmount, orderId]
              );
            } else {
              await connection.rollback();
              return res.status(400).json({ error: "Invalid order amount." });
            }
          } else {
            await connection.rollback();
            return res.status(400).json({ error: "Invalid order amount." });
          }
        } else {
          // Try to parse it as a normal number
          const parsedAmount = parseFloat(order.total_amount);
          if (!isNaN(parsedAmount) && parsedAmount > 0) {
            order.total_amount = parsedAmount;
          } else {
            await connection.rollback();
            return res.status(400).json({ error: "Invalid order amount." });
          }
        }
      } else {
        await connection.rollback();
        return res.status(400).json({ error: "Invalid order amount." });
      }
    }

    // Create a new payment request
    const createPaymentQuery = `
      INSERT INTO payment_requests (order_id, amount, status)
      VALUES (?, ?, 'PENDING');
    `;
    const [paymentResult] = await connection.query(createPaymentQuery, [orderId, order.total_amount]);
    const paymentId = paymentResult.insertId;

    // UPI Deep Link Templates
    const appPackages = {
      gpay: "com.google.android.apps.nbu.paisa.user",
      phonepe: "com.phonepe.app",
      paytm: "net.one97.paytm",
    };

    const upiLinks = Object.keys(appPackages).reduce((acc, app) => {
      acc[app] = `upi://pay?pa=${encodeURIComponent(
        order.merchant_vpa || "merchant@upi"
      )}&pn=${encodeURIComponent(
        order.merchant_name || "Restaurant"
      )}&am=${order.total_amount}&cu=INR&tr=${paymentId}&tn=Payment for order ${
        order.order_id
      }&url=https://myding.in&package=${appPackages[app]}`;

      return acc;
    }, {});

    await connection.commit();

    res.status(200).json({ 
      orderId: order.order_id, 
      totalAmount: parseFloat(order.total_amount), 
      upiLinks,
      orderType: order.order_type || 'PAY_AND_PLACE',
      status: order.order_status,
      paymentId
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error fetching payment details:", error);
    res.status(500).json({ error: "Failed to fetch payment details." });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Group payment endpoint
router.get("/group/:groupId", async (req, res) => {
  const { groupId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Fetch group and restaurant info
    const [groupRows] = await connection.query(
      `SELECT og.*, r.merchant_vpa, r.merchant_name
       FROM OrderGroups og
       JOIN Restaurants r ON og.restaurant_id = r.id
       WHERE og.id = ?`,
      [groupId]
    );
    if (!groupRows.length) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Group not found' });
    }
    const group = groupRows[0];

    // Calculate total (sum of all finalized orders in the group)
    const [orderRows] = await connection.query(
      `SELECT SUM(total_amount) as total FROM Orders WHERE order_group_id = ? AND payment_status != 'CANCELLED'`,
      [groupId]
    );
    const totalAmount = orderRows[0]?.total || 0;

    // UPI Deep Link Templates
    const appPackages = {
      gpay: "com.google.android.apps.nbu.paisa.user",
      phonepe: "com.phonepe.app",
      paytm: "net.one97.paytm",
    };

    // Prepare UPI links for each supported app
    const upiLinks = {};
    if (group.merchant_vpa) {
      upiLinks.gpay = `upi://pay?pa=${encodeURIComponent(group.merchant_vpa)}&pn=${encodeURIComponent(group.merchant_name || "Restaurant")}&am=${totalAmount}&cu=INR&tr=GROUP${groupId}&tn=Group Payment for #${groupId}&url=https://myding.in&package=${appPackages.gpay}`;
    }
    if (group.merchant_vpa) {
      upiLinks.phonepe = `upi://pay?pa=${encodeURIComponent(group.merchant_vpa)}&pn=${encodeURIComponent(group.merchant_name || "Restaurant")}&am=${totalAmount}&cu=INR&tr=GROUP${groupId}&tn=Group Payment for #${groupId}&url=https://myding.in&package=${appPackages.phonepe}`;
    }
    if (group.merchant_vpa) {
      upiLinks.paytm = `upi://pay?pa=${encodeURIComponent(group.merchant_vpa)}&pn=${encodeURIComponent(group.merchant_name || "Restaurant")}&am=${totalAmount}&cu=INR&tr=GROUP${groupId}&tn=Group Payment for #${groupId}&url=https://myding.in&package=${appPackages.paytm}`;
    }

    await connection.commit();

    return res.json({
      success: true,
      upiLinks,
      totalAmount,
      groupStatus: group.group_status,
      restaurantName: group.merchant_name
    });
  } catch (err) {
    if (connection) await connection.rollback();
    console.error('Error fetching group payment info:', err);
    return res.status(500).json({ success: false, error: 'Failed to fetch group payment info' });
  } finally {
    if (connection) connection.release();
  }
});

// Create a Razorpay payment routed to the restaurant's linked account
router.post('/razorpay/:orderId', async (req, res) => {
  const { orderId } = req.params;
  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Fetch order and restaurant info
    const [orderRows] = await connection.query(
      `SELECT o.id AS order_id, o.total_amount, r.razorpay_account_id
       FROM Orders o
       JOIN Restaurants r ON o.restaurant_id = r.id
       WHERE o.id = ?`,
      [orderId]
    );
    const order = orderRows[0];
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ error: 'Order not found' });
    }
    if (!order.razorpay_account_id) {
      await connection.rollback();
      return res.status(400).json({ error: 'Restaurant is not onboarded to Razorpay' });
    }

    // Create payment via Razorpay
    const paymentData = {
      amount: Math.round(order.total_amount * 100), // in paise
      currency: 'INR',
      receipt: `order_${order.order_id}`,
      payment_capture: 1,
      ...req.body // allow additional params if needed
    };
    const payment = await createRoutedPayment(paymentData, order.razorpay_account_id);

    await connection.commit();
    res.json({ success: true, payment });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error creating Razorpay payment:', error);
    res.status(500).json({ error: 'Failed to create Razorpay payment', details: error.message });
  } finally {
    if (connection) connection.release();
  }
});

module.exports = router;
