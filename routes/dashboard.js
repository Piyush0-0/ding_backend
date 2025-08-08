const express = require('express');
const { authenticateUser } = require('../middlewares/authenticateUser');
const db = require('../db');

const router = express.Router();

// Dashboard Statistics endpoint
router.get('/stats', authenticateUser, async (req, res) => {
  const { restaurantId } = req.query;
  const { userId, role } = req.user;
  
  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }
  
  try {
    // Verify restaurant ownership or admin access
    if (role !== 'RESTAURANT_OWNER' && role !== 'ADMIN') {
      return res.status(403).json({ error: "Access denied" });
    }

    // For restaurant owners, verify they own this restaurant
    if (role === 'RESTAURANT_OWNER') {
      const [ownershipCheck] = await db.query(
        'SELECT id FROM Restaurants WHERE id = ? AND created_by_user_id = ?',
        [restaurantId, userId]
      );
      if (!ownershipCheck) {
        return res.status(403).json({ error: "Access denied - not your restaurant" });
      }
    }

    // Get total orders count
    const totalOrdersQuery = `
      SELECT COUNT(*) as total_orders 
      FROM Orders 
      WHERE restaurant_id = ?
    `;
    const [totalOrdersResult] = await db.query(totalOrdersQuery, [restaurantId]);
    const totalOrders = totalOrdersResult[0]?.total_orders || 0;

    // Get total revenue
    const totalRevenueQuery = `
      SELECT COALESCE(SUM(total_amount), 0) as total_revenue 
      FROM Orders 
      WHERE restaurant_id = ? AND order_status NOT IN ('cancelled', 'failed')
    `;
    const [totalRevenueResult] = await db.query(totalRevenueQuery, [restaurantId]);
    const totalRevenue = parseFloat(totalRevenueResult[0]?.total_revenue || 0);

    // Calculate average order value
    const avgOrderValue = totalOrders > 0 ? (totalRevenue / totalOrders) : 0;

    // Get pending orders count
    const pendingOrdersQuery = `
      SELECT COUNT(*) as pending_orders 
      FROM Orders 
      WHERE restaurant_id = ? AND order_status IN ('pending', 'confirmed', 'preparing')
    `;
    const [pendingOrdersResult] = await db.query(pendingOrdersQuery, [restaurantId]);
    const pendingOrders = pendingOrdersResult[0]?.pending_orders || 0;

    // Get today's orders
    const todayOrdersQuery = `
      SELECT COUNT(*) as today_orders,
             COALESCE(SUM(total_amount), 0) as today_revenue
      FROM Orders 
      WHERE restaurant_id = ? 
      AND DATE(created_at) = CURDATE()
      AND order_status NOT IN ('cancelled', 'failed')
    `;
    const [todayResult] = await db.query(todayOrdersQuery, [restaurantId]);
    const todayOrders = todayResult[0]?.today_orders || 0;
    const todayRevenue = parseFloat(todayResult[0]?.today_revenue || 0);

    const stats = {
      totalOrders,
      totalRevenue: Math.round(totalRevenue * 100) / 100, // Round to 2 decimal places
      avgOrderValue: Math.round(avgOrderValue * 100) / 100,
      pendingOrders,
      todayOrders,
      todayRevenue: Math.round(todayRevenue * 100) / 100
    };

    res.json(stats);

  } catch (error) {
    console.error("Error fetching restaurant stats:", error);
    res.status(500).json({ error: "Failed to fetch restaurant statistics" });
  }
});

// Dashboard Orders endpoint
router.get('/orders', authenticateUser, async (req, res) => {
  const { restaurantId, limit = 10, status = 'all', page = 1 } = req.query;
  const { userId, role } = req.user;
  
  if (!restaurantId) {
    return res.status(400).json({ error: "Restaurant ID is required" });
  }
  
  try {
    // Verify restaurant ownership or admin access
    if (role !== 'RESTAURANT_OWNER' && role !== 'ADMIN') {
      return res.status(403).json({ error: "Access denied" });
    }

    // For restaurant owners, verify they own this restaurant
    if (role === 'RESTAURANT_OWNER') {
      const [ownershipCheck] = await db.query(
        'SELECT id FROM Restaurants WHERE id = ? AND created_by_user_id = ?',
        [restaurantId, userId]
      );
      if (!ownershipCheck) {
        return res.status(403).json({ error: "Access denied - not your restaurant" });
      }
    }

    let statusCondition = '';
    if (status !== 'all') {
      if (status === 'recent') {
        statusCondition = `ORDER BY o.created_at DESC`;
      } else {
        statusCondition = `AND o.order_status = '${status}'`;
      }
    }

    const offset = (page - 1) * limit;
    
    const ordersQuery = `
      SELECT 
        o.id,
        o.order_number,
        o.total_amount,
        o.order_status as status,
        o.order_type,
        o.created_at,
        o.updated_at,
        u.name as customer_name,
        u.phoneNumber as customer_phone
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.id
      WHERE o.restaurant_id = ? ${statusCondition}
      ${status === 'recent' ? '' : 'ORDER BY o.created_at DESC'}
      LIMIT ? OFFSET ?
    `;

    const orders = await db.query(ordersQuery, [restaurantId, parseInt(limit), parseInt(offset)]);

    // Get total count for pagination
    const countQuery = `
      SELECT COUNT(*) as total_count 
      FROM Orders o 
      WHERE o.restaurant_id = ? ${statusCondition.replace('ORDER BY o.created_at DESC', '')}
    `;
    const [countResult] = await db.query(countQuery, [restaurantId]);
    const totalCount = countResult[0]?.total_count || 0;

    res.json({
      orders,
      pagination: {
        currentPage: parseInt(page),
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        limit: parseInt(limit)
      }
    });

  } catch (error) {
    console.error("Error fetching restaurant orders:", error);
    res.status(500).json({ error: "Failed to fetch restaurant orders" });
  }
});

module.exports = router; 