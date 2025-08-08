const express = require("express");
const router = express.Router();
const db = require("../db");
const {
  authenticateUser,
  optionalAuthenticateUser,
} = require("../middlewares/authenticateUser");
const { updateOrderPOSStatus } = require('../models/order');
const posIntegrationService = require('../services/posIntegrationService');

/**
 * Creates a new order from the active cart
 * @route POST /order/create
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with order details
 */
router.post("/create", authenticateUser, async (req, res) => {
  const { userId } = req.user;
  const { pickup_eta_minutes } = req.body;

  if (!userId) {
    return res.status(400).json({ 
      success: false,
      error: "User ID is required." 
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Retrieve active cart with order_type
    const cartQuery = `
      SELECT c.id, c.restaurant_id, c.order_group_id, c.order_type
      FROM Cart c
      WHERE c.user_id = ? AND c.is_finalized = FALSE
      ORDER BY c.created_at DESC LIMIT 1
    `;
    const [rows] = await connection.query(cartQuery, [userId]);
    const cart = rows[0];

    if (!cart) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false,
        error: "No active cart found." 
      });
    }

    if (!cart.restaurant_id) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false,
        error: "Cart is missing restaurant information. Please create a new cart." 
      });
    }

    // Get order_type from cart, default to DINE_IN if not set
    const order_type = cart.order_type || 'DINE_IN';

    // If cart has order_group_id, verify the group is still active
    if (cart.order_group_id) {
      const groupQuery = `
        SELECT * FROM OrderGroups 
        WHERE id = ? AND group_status = 'active'
      `;
      const [groupRows] = await connection.query(groupQuery, [cart.order_group_id]);
      
      if (groupRows.length === 0) {
        await connection.rollback();
        return res.status(400).json({ 
          success: false,
          error: "The group order is no longer active." 
        });
      }
    }

    // Get restaurant payment acceptance type configuration
    const restaurantQuery = `
      SELECT payment_acceptance_type, is_active
      FROM Restaurants
      WHERE id = ?
    `;
    const [restaurantRows] = await connection.query(restaurantQuery, [cart.restaurant_id]);
    const restaurant = restaurantRows[0];
    
    if (!restaurant) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false,
        error: "Restaurant not found." 
      });
    }

    // Calculate detailed breakdown using the enhanced function with cart ID
    const { calculateCartTotalsByCartId } = require('../utils/cartCalculations');
    const totals = await calculateCartTotalsByCartId(cart.id);

    // Ensure total amount is valid
    if (!totals.total || totals.total <= 0) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false,
        error: "Invalid order amount calculated." 
      });
    }

    // Check if POS integration exists for this restaurant
    const { getPosConfiguration } = require('../services/posConfigService');
    let hasPosIntegration = false;
    try {
      await getPosConfiguration(cart.restaurant_id, 'petpooja');
      hasPosIntegration = true;
    } catch (error) {
      // No POS integration found, continue without it
      hasPosIntegration = false;
    }

    // --- PICKUP LOGIC START ---
    let finalOrderType = order_type.toUpperCase();
    if (!['DINE_IN', 'PICKUP', 'DELIVERY'].includes(finalOrderType)) {
      finalOrderType = 'DINE_IN';
    }
    let orderGroupId = cart.order_group_id || null;
    let initialStatus = 'pending';
    let pickupEta = null;
    let pickupRequestedAt = null;

    if (finalOrderType === 'PICKUP') {
      // For pickup, always PayAndPlace, no group
      orderGroupId = null;
      initialStatus = 'pending_payment';
      pickupEta = pickup_eta_minutes || null;
      // pickupRequestedAt will be set when user notifies
    } else {
      // Dine-in or other types
      const restaurantOrderType = restaurant.payment_acceptance_type || 'PAY_AND_PLACE';
      initialStatus = orderGroupId ? 'pending' : (restaurantOrderType === 'PAY_AND_PLACE' ? 'pending_payment' : 'pending');
    }
    // --- PICKUP LOGIC END ---

    // Create an order
    const orderQuery = `
      INSERT INTO Orders (
        user_id, 
        restaurant_id, 
        order_group_id,
        order_status, 
        payment_status,
        total_amount,
        item_total,
        delivery_charge,
        packaging_charge,
        service_charge,
        tax_amount,
        order_type,
        pickup_eta_minutes,
        pickup_requested_at,
        created_at,
        updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW(), NOW());
    `;
    const [orderResult] = await connection.query(orderQuery, [
      userId,
      cart.restaurant_id,
      orderGroupId,
      initialStatus.toLowerCase(),
      'pending',
      totals.total,
      totals.subtotal,
      totals.deliveryCharge,
      totals.packagingCharge,
      totals.serviceCharge,
      totals.taxAmount,
      finalOrderType,
      pickupEta,
      pickupRequestedAt
    ]);
    const orderId = orderResult.insertId;
    console.log('Order insert result:', orderResult, 'orderId:', orderId);

    // Move CartItems to OrderItems with initial status
    const moveItemsQuery = `
      INSERT INTO OrderItems (
        order_id, 
        item_id, 
        variation_id, 
        quantity, 
        unit_price,
        add_ons_total,
        addon_items,
        status,
        created_at,
        updated_at
      )
      SELECT 
        ?, 
        ci.item_id, 
        ci.variation_id, 
        ci.quantity, 
        ci.unit_price,
        ci.add_ons_total,
        ci.addon_items,
        'ADDED',
        NOW(),
        NOW()
      FROM CartItems ci
      WHERE ci.cart_id = ?;
    `;
    await connection.query(moveItemsQuery, [orderId, cart.id]);

    // Update the Cart as finalized
    await connection.query("UPDATE Cart SET is_finalized = TRUE WHERE id = ?", [cart.id]);

    // If part of a group order, update the group's total amount
    if (orderGroupId) {
      const updateGroupTotalQuery = `
        UPDATE OrderGroups 
        SET total_amount = total_amount + ?, 
            updated_at = NOW() 
        WHERE id = ?
      `;
      await connection.query(updateGroupTotalQuery, [totals.total, orderGroupId]);
    }

    // Commit the transaction first to release database locks
    await connection.commit();
    connection.release();

    // Now do POS integration after transaction is committed (no DB locks held)
    if (hasPosIntegration) {
      try {
        await posIntegrationService.pushOrderToPOS(orderId);
        console.log('✅ POS push successful after transaction commit');
        
        // Update POS status to indicate successful sync
        try {
          await updateOrderPOSStatus(orderId, 'success', null);
        } catch (err) {
          console.error('Failed to update POS status to success:', err);
        }
      } catch (posError) {
        console.error('❌ POS push failed after commit:', posError);
        
        // Update POS status to indicate failed sync
        try {
          await updateOrderPOSStatus(orderId, 'failed', JSON.stringify({
            error: posError.message,
            timestamp: new Date().toISOString()
          }));
        } catch (err) {
          console.error('Failed to update POS status to failed:', err);
        }
      }
    } else {
      // No POS integration, set status to indicate no sync needed
      try {
        await updateOrderPOSStatus(orderId, 'pending', 'No POS integration configured');
      } catch (err) {
        console.error('Failed to update POS status to pending:', err);
      }
    }

    res.status(200).json({ 
      success: true,
      data: {
        message: "Order created successfully", 
        orderId,
        orderType: finalOrderType,
        status: initialStatus,
        isGroupOrder: !!orderGroupId,
        groupOrderId: orderGroupId
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      console.error('Transaction rolled back due to error:', error);
    }
    console.error("Error creating order:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to create order.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Updates the status of an order
 * @route POST /order/:orderId/update-status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with update status
 */
router.post("/:orderId/update-status", authenticateUser, async (req, res) => {
  const { userId } = req.user;
  const { orderId } = req.params;
  const { status } = req.body;

  const validStatuses = [
    "pending",
    "pending_payment",
    "confirmed",
    "preparing",
    "ready",
    "delivered",
    "cancelled"
  ];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false,
      error: "Invalid status update." 
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if order belongs to the user and get order type
    const checkOrderQuery = `
      SELECT o.id, o.order_status, o.payment_status, o.order_group_id, r.payment_acceptance_type as order_type
      FROM Orders o
      JOIN Restaurants r ON o.restaurant_id = r.id
      WHERE o.id = ? AND o.user_id = ?
    `;
    const [order] = await connection.query(checkOrderQuery, [orderId, userId]);

    if (!order) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false,
        error: "Order not found for this user." 
      });
    }

    // Block status updates for orders in a group order
    if (order.order_group_id) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: "Status updates must be performed at the group order level."
      });
    }

    // Validate status transition
    const isValidTransition = validateStatusTransition(
      order.order_status,
      status,
      order.order_type || 'PAY_AND_PLACE'
    );
    if (!isValidTransition) {
      await connection.rollback();
      return res.status(400).json({ 
        success: false,
        error: "Invalid status transition." 
      });
    }

    // Update the order status
    const updateQuery = `
      UPDATE Orders 
      SET order_status = ?, updated_at = NOW() 
      WHERE id = ?
    `;
    await connection.query(updateQuery, [status.toLowerCase(), orderId]);

    // Handle payment status updates based on order type and status
    if (order.order_type === 'PAY_AND_PLACE') {
      if (status === 'confirmed') {
        // Payment is successful when order is confirmed for PAY_AND_PLACE
        await connection.query(
          `UPDATE Orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`,
          [orderId]
        );
      }
    } else if (order.order_type === 'PAY_AT_END') {
      if (status === 'ready') {
        // For PAY_AT_END, payment is pending until explicitly marked as paid
        await connection.query(
          `UPDATE Orders SET payment_status = 'pending', updated_at = NOW() WHERE id = ?`,
          [orderId]
        );
      }
    }

    await connection.commit();

    res.status(200).json({ 
      success: true,
      data: {
        message: "Order status updated successfully." 
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error updating order status:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to update order status.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Updates the status of a specific order item
 * @route POST /order/:orderId/items/:itemId/update-status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with update status
 */

router.patch('/:orderId', async (req, res) => {
  const { orderId } = req.params;
  const { has_reviewed } = req.body;

  if (typeof has_reviewed !== 'boolean') {
    return res.status(400).json({ error: 'Invalid has_reviewed value' });
  }

  const result = await db.query(
  'UPDATE orders SET has_reviewed = ? WHERE id = ?',
  [has_reviewed, orderId]
);

const affectedRows = result.affectedRows ?? result[0]?.affectedRows;

if (!affectedRows) {
  return res.status(404).json({ error: 'Order not found' });
}

res.status(200).json({ message: 'Order updated successfully' });

});
router.post("/:orderId/items/:itemId/update-status", authenticateUser, async (req, res) => {
  const { userId } = req.user;
  const { orderId, itemId } = req.params;
  const { status } = req.body;

  const validStatuses = ["ADDED", "SENT_TO_KITCHEN", "SERVED", "CANCELLED"];

  if (!validStatuses.includes(status)) {
    return res.status(400).json({ 
      success: false,
      error: "Invalid item status update." 
    });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Check if order belongs to the user
    const checkOrderQuery = `
      SELECT o.id, o.order_status, r.payment_acceptance_type as order_type
      FROM Orders o
      JOIN OrderItems oi ON o.id = oi.order_id
      JOIN Restaurants r ON o.restaurant_id = r.id
      WHERE o.id = ? AND o.user_id = ? AND oi.id = ?
    `;
    const [order] = await connection.query(checkOrderQuery, [orderId, userId, itemId]);

    if (!order) {
      await connection.rollback();
      return res.status(404).json({ 
        success: false,
        error: "Order not found or item does not belong to this order." 
      });
    }

    // Update the order item status
    const updateQuery = `
      UPDATE OrderItems 
      SET status = ?, updated_at = NOW() 
      WHERE id = ? AND order_id = ?
    `;
    await connection.query(updateQuery, [status, itemId, orderId]);

    // Check if all items are served
    if (status === 'SERVED') {
      const checkAllServedQuery = `
        SELECT COUNT(*) as total,
        SUM(CASE WHEN status = 'SERVED' THEN 1 ELSE 0 END) as served
        FROM OrderItems
        WHERE order_id = ?
      `;
      const [counts] = await connection.query(checkAllServedQuery, [orderId]);
      
      if (counts.total === counts.served) {
        // Update order status to completed if all items are served
        await connection.query(
          `UPDATE Orders SET order_status = 'ready', updated_at = NOW() WHERE id = ?`,
          [orderId]
        );

        // If it's a PAY_AT_END order, update payment status
        if (order.order_type === 'PAY_AT_END') {
          await connection.query(
            `UPDATE Orders SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`,
            [orderId]
          );
        }
      }
    }

    await connection.commit();

    res.status(200).json({ 
      success: true,
      data: {
        message: "Order item status updated successfully." 
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error updating order item status:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to update order item status.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Gets detailed information about an order
 * @route GET /order/:orderId
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with order details
 */
router.get("/:orderId", authenticateUser, async (req, res) => {
  const { userId } = req.user;
  const { orderId } = req.params;

  try {
    // Check if order belongs to the user and get restaurant info in one query
    const checkOrderQuery = `
      SELECT o.id, o.user_id, o.restaurant_id, o.order_status, o.payment_status, o.created_at, o.updated_at,
             o.order_type, o.pickup_eta_minutes, o.pickup_requested_at,
             o.total_amount, o.item_total, o.delivery_charge, o.packaging_charge, o.service_charge, o.tax_amount,
             r.payment_acceptance_type as restaurant_payment_acceptance_type
      FROM Orders o
      JOIN Restaurants r ON o.restaurant_id = r.id
      WHERE o.id = ? AND o.user_id = ?
    `;
    const [order] = await db.query(checkOrderQuery, [orderId, userId]);

    if (!order) {
      return res.status(404).json({ 
        success: false,
        error: "Order not found for this user." 
      });
    }

    // Get order items with prep_time for timer calculation
    const itemsQuery = `
      SELECT 
        oi.id, 
        oi.item_id, 
        oi.variation_id, 
        oi.addon_items, 
        oi.quantity, 
        oi.unit_price, 
        oi.status,
        oi.quantity * oi.unit_price as item_total,
        i.name as item_name,
        i.prep_time as prep_time,
        v.name as variation_name,
        v.price as variation_price
      FROM OrderItems oi
      LEFT JOIN Items i ON oi.item_id = i.id
      LEFT JOIN Variations v ON oi.variation_id = v.id
      WHERE oi.order_id = ?
    `;
    const items = await db.query(itemsQuery, [orderId]);

    // Process add-ons for each item
    for (let item of items) {
      if (item.addon_items) {
        try {
          const addonIds = JSON.parse(item.addon_items).map(addon => addon.id);
          if (addonIds.length > 0) {
            // Create placeholders for each ID
            const placeholders = addonIds.map(() => '?').join(',');
            const addonsQuery = `
              SELECT id, name, price
              FROM AddOnItems
              WHERE id IN (${placeholders})
            `;
            const addons = await db.query(addonsQuery, addonIds);
            item.addons = addons;
          } else {
            item.addons = [];
          }
        } catch (error) {
          console.error("Error parsing addon_items:", error);
          item.addons = [];
        }
      } else {
        item.addons = [];
      }
    }

    // Compute expected ready time and server time for countdown
    const maxPrepTime = items.reduce((max, item) => {
      const prep = item.prep_time || 15;
      return Math.max(max, prep);
    }, 0);
    const createdAt = new Date(order.created_at);
    const expectedReady = new Date(createdAt.getTime() + maxPrepTime * 60000).toISOString();
    const serverTime = new Date().toISOString();

    res.status(200).json({
      success: true,
      data: {
        order: {
          ...order,
          total_amount: parseFloat(order.total_amount),
          item_total: parseFloat(order.item_total),
          delivery_charge: parseFloat(order.delivery_charge),
          packaging_charge: parseFloat(order.packaging_charge),
          service_charge: parseFloat(order.service_charge),
          tax_amount: parseFloat(order.tax_amount),
          order_type: order.order_type,
          pickup_eta_minutes: order.pickup_eta_minutes,
          pickup_requested_at: order.pickup_requested_at
        },
        items,
        expected_ready_time: expectedReady,
        server_time: serverTime
      }
    });
  } catch (error) {
    console.error("Error fetching order details:", error);
    res.status(500).json({ 
      success: false,
      error: "Failed to fetch order details.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Validates if a status transition is allowed based on current status and order type
 * @param {string} currentStatus - Current status of the order
 * @param {string} newStatus - New status to transition to
 * @param {string} orderType - Type of order (PAY_AND_PLACE or PAY_AT_END)
 * @returns {boolean} Whether the transition is valid
 */
function validateStatusTransition(currentStatus, newStatus, orderType) {
  // Define valid transitions based on order type
  const validTransitions = {
    'PAY_AND_PLACE': {
      'pending': ['pending_payment', 'cancelled'],
      'pending_payment': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    },
    'PAY_AT_END': {
      'pending': ['confirmed', 'cancelled'],
      'confirmed': ['preparing', 'cancelled'],
      'preparing': ['ready', 'cancelled'],
      'ready': ['delivered', 'cancelled'],
      'delivered': [],
      'cancelled': []
    }
  };

  // Make sure we're comparing using lowercase status values
  const normalizedCurrentStatus = currentStatus ? currentStatus.toLowerCase() : '';
  
  // Check if the transition is valid
  return validTransitions[orderType]?.[normalizedCurrentStatus]?.includes(newStatus) ?? false;
}

/**
 * Confirm payment for a PAY_AND_PLACE order
 * @route POST /order/:orderId/confirm-payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success
 */
router.post('/:orderId/confirm-payment', authenticateUser, async (req, res) => {
  const { userId } = req.user;
  const { orderId } = req.params;

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Fetch the order and check ownership and type
    const [orderRows] = await connection.query(
      `SELECT o.id, o.user_id, o.order_status, o.payment_status, r.payment_acceptance_type as order_type
       FROM Orders o
       JOIN Restaurants r ON o.restaurant_id = r.id
       WHERE o.id = ? AND o.user_id = ?`,
      [orderId, userId]
    );
    const order = orderRows[0];
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Order not found for this user.' });
    }
    if (order.order_type !== 'PAY_AND_PLACE') {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Order is not a Pay and Place order.' });
    }
    if (order.order_status !== 'pending_payment') {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'Order is not awaiting payment confirmation.' });
    }

    // Update order status and payment status
    await connection.query(
      `UPDATE Orders SET order_status = 'confirmed', payment_status = 'paid', updated_at = NOW() WHERE id = ?`,
      [orderId]
    );

    await connection.commit();
    connection.release();
    return res.status(200).json({ success: true, message: 'Payment confirmed and order placed.' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Error confirming payment:', error);
    return res.status(500).json({ success: false, error: 'Failed to confirm payment.' });
  }
});

/**
 * Add pickup notification endpoint
 * @route POST /order/:orderId/pickup-ready
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success
 */
router.post('/:orderId/pickup-ready', authenticateUser, async (req, res) => {
  const { orderId } = req.params;
  const { eta_minutes } = req.body;
  const { userId } = req.user;

  if (!eta_minutes || isNaN(eta_minutes) || eta_minutes < 1) {
    return res.status(400).json({ success: false, error: 'Valid eta_minutes is required.' });
  }

  let connection;
  try {
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Fetch the order and check ownership and type
    const [orderRows] = await connection.query(
      `SELECT id, user_id, order_type, order_status FROM Orders WHERE id = ? AND user_id = ?`,
      [orderId, userId]
    );
    const order = orderRows[0];
    if (!order) {
      await connection.rollback();
      return res.status(404).json({ success: false, error: 'Order not found for this user.' });
    }
    if (order.order_type !== 'PICKUP') {
      await connection.rollback();
      return res.status(400).json({ success: false, error: 'This is not a pickup order.' });
    }

    // Update pickup fields and optionally order_status
    await connection.query(
      `UPDATE Orders SET pickup_eta_minutes = ?, pickup_requested_at = NOW(), order_status = 'preparing', updated_at = NOW() WHERE id = ?`,
      [eta_minutes, orderId]
    );

    await connection.commit();
    connection.release();

    // Trigger POS push after commit
    try {
      await posIntegrationService.pushOrderToPOS(orderId);
    } catch (err) {
      console.error('POS push failed after pickup notification:', err);
    }

    return res.status(200).json({ success: true, message: 'Pickup notification sent.' });
  } catch (error) {
    if (connection) {
      await connection.rollback();
      connection.release();
    }
    console.error('Error in pickup-ready:', error);
    return res.status(500).json({ success: false, error: 'Failed to notify pickup.' });
  }
});

module.exports = router;