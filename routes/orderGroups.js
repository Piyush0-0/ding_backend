const express = require("express");
const router = express.Router();
const db = require("../db");
const { v4: uuidv4 } = require('uuid');
const { authenticateUser, optionalAuthenticateUser } = require("../middlewares/authenticateUser");

/**
 * Creates a new order group
 * @route POST /order-groups/create
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with order group details
 */
router.post("/create", optionalAuthenticateUser, async (req, res) => {
  let connection;
  try {
    const { restaurant_id, location_type, table_id, location_details } = req.body;
    const session_id = req.body.session_id; // Get session_id from body
    const userId = req.user ? req.user.userId : null;
    
    // Validate required fields
    if (!restaurant_id || !location_type) {
      return res.status(400).json({
        success: false,
        error: "Restaurant ID and location type are required."
      });
    }

    // Validate location type
    const validLocationTypes = ['TABLE', 'DELIVERY', 'PICKUP'];
    if (!validLocationTypes.includes(location_type)) {
      return res.status(400).json({
        success: false,
        error: "Invalid location type. Must be TABLE, DELIVERY, or PICKUP."
      });
    }

    // Generate a unique QR code
    const qrCode = uuidv4();

    connection = await db.getConnection();
    await connection.beginTransaction();

    // ENFORCE: Only one active orderGroup per user/session
    const existingGroup = await findActiveOrderGroup(connection, userId, session_id);
    if (existingGroup) {
      await connection.rollback();
      return res.status(409).json({
        error: "active_ordergroup_exists",
        orderGroup: {
          id: existingGroup.id,
          restaurant: existingGroup.restaurant_name,
          group_status: existingGroup.group_status
        }
      });
    }

    // FIXED: Resolve any cart conflicts before creating group
    await resolveCartConflicts(connection, userId, session_id, restaurant_id, null, 'DINE_IN');

    // Create the order group
    const createGroupQuery = `
      INSERT INTO OrderGroups (
        restaurant_id, 
        table_id, 
        location_type, 
        location_details, 
        qr_code, 
        session_id,
        group_status,
        payment_status,
        created_at,
        updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'active', 'pending', NOW(), NOW())
    `;

    console.log(`[DEBUG] About to execute group creation query with params:`, [
      restaurant_id,
      table_id || null,
      location_type,
      location_details ? JSON.stringify(location_details) : null,
      qrCode,
      session_id
    ]);

    const groupResult = await connection.query(createGroupQuery, [
      restaurant_id,
      table_id || null,
      location_type,
      location_details ? JSON.stringify(location_details) : null,
      qrCode,
      session_id
    ]);

    // FIXED: Handle different query result structures
    const groupId = groupResult.insertId || (Array.isArray(groupResult) ? groupResult[0]?.insertId : null);
    console.log(`[DEBUG] Group creation result:`, groupResult);
    console.log(`[DEBUG] Extracted groupId:`, groupId);
    
    if (!groupId) {
      throw new Error('Failed to get group ID from database insert');
    }

    // FIXED: Add participant consistently
    await addGroupParticipant(connection, groupId, userId, session_id);

    // Create a cart for the user or session (if not already exists)
    if (req.user) {
      const { userId } = req.user;
      // Check if cart already exists for this user and group
      const [existingCart] = await connection.query(
        `SELECT id FROM Cart WHERE user_id = ? AND restaurant_id = ? AND order_group_id = ? AND is_finalized = 0 LIMIT 1`,
        [userId, restaurant_id, groupId]
      );
      if (existingCart.length === 0) {
        await connection.query(
          `INSERT INTO Cart (user_id, restaurant_id, order_group_id, is_finalized, created_at, updated_at) VALUES (?, ?, ?, 0, NOW(), NOW())`,
          [userId, restaurant_id, groupId]
        );
      }
    } else if (session_id) {
      // Guest session: Check if cart already exists for this session and group
      const [existingCart] = await connection.query(
        `SELECT id FROM Cart WHERE session_id = ? AND restaurant_id = ? AND order_group_id = ? AND is_finalized = 0 LIMIT 1`,
        [session_id, restaurant_id, groupId]
      );
      if (existingCart.length === 0) {
        await connection.query(
          `INSERT INTO Cart (session_id, restaurant_id, order_group_id, is_finalized, created_at, updated_at) VALUES (?, ?, ?, 0, NOW(), NOW())`,
          [session_id, restaurant_id, groupId]
        );
      }
    }

    await connection.commit();

    // Helper to get table_number from table_id
    const tableNumber = await getTableNumber(connection, table_id || null);

    // Return the group information with QR code
    return res.status(201).json({
      success: true,
      data: {
        id: groupId,
        restaurant_id,
        table_id: table_id || null,
        table_number: tableNumber,
        location_type,
        location_details: location_details || null,
        qr_code: qrCode,
        group_status: 'active',
        session_id
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error creating order group:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to create order group.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Get an order group by QR code
 * @route GET /order-groups/by-code/:qrCode
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with order group details
 */
router.get("/by-code/:qrCode", async (req, res) => {
  try {
    const { qrCode } = req.params;

    if (!qrCode) {
      return res.status(400).json({
        success: false,
        error: "QR code is required."
      });
    }

    // Find the order group
    const getGroupQuery = `
      SELECT 
        og.id,
        og.restaurant_id,
        og.table_id,
        og.location_type,
        og.location_details,
        og.qr_code,
        og.group_status,
        og.payment_status,
        og.total_amount,
        r.name as restaurant_name,
        r.address as restaurant_address
      FROM OrderGroups og
      JOIN Restaurants r ON og.restaurant_id = r.id
      WHERE og.qr_code = ? AND og.group_status = 'active'
    `;
    
    const groupResult = await db.query(getGroupQuery, [qrCode]);

    if (groupResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Order group not found or no longer active."
      });
    }

    const orderGroup = groupResult[0];

    // Helper to get table_number from table_id
    const tableNumber = await getTableNumber(db, orderGroup.table_id);
    orderGroup.table_number = tableNumber;
    console.log(`[DEBUG] Assigned table_number to orderGroup:`, orderGroup.table_number);

    // Get orders in this group
    const getOrdersQuery = `
      SELECT 
        o.id,
        o.user_id,
        COALESCE(u.name, 'Anonymous') as user_name,
        o.total_amount,
        o.status as order_status,
        o.payment_status
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.id
      WHERE o.order_group_id = ?
    `;
    
    const ordersResult = await db.query(getOrdersQuery, [orderGroup.id]);

    return res.status(200).json({
      success: true,
      data: {
        ...orderGroup,
        location_details: orderGroup.location_details ? JSON.parse(orderGroup.location_details) : null,
        orders: ordersResult
      }
    });
  } catch (error) {
    console.error("Error fetching order group:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch order group.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Join an order group
 * @route POST /order-groups/:groupId/join
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success
 */
router.post("/:groupId/join", optionalAuthenticateUser, async (req, res) => {
  let connection;
  try {
    const { groupId } = req.params;
    const { session_id } = req.body; // Get session_id from body instead of req.session.id
    const userId = req.user ? req.user.userId : null;

    // Validate the group ID
    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: "Group ID is required."
      });
    }

    // Validate that either userId or session_id is provided
    if (!userId && !session_id) {
      return res.status(400).json({
        success: false,
        error: "Either user authentication or session_id is required."
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // ENFORCE: Only one active orderGroup per user/session
    const existingGroup = await findActiveOrderGroup(connection, userId, session_id);
    if (existingGroup && existingGroup.id != groupId) {
      await connection.rollback();
      return res.status(409).json({
        error: "active_ordergroup_exists",
        orderGroup: {
          id: existingGroup.id,
          restaurant: existingGroup.restaurant_name,
          group_status: existingGroup.group_status
        }
      });
    }

    // Check if the group exists and is active
    const getGroupQuery = `
      SELECT * FROM OrderGroups 
      WHERE id = ? AND group_status = 'active'
    `;
    
    const [groupRows] = await connection.query(getGroupQuery, [groupId]);

    if (groupRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: "Order group not found or no longer active."
      });
    }

    const orderGroup = groupRows[0];

    // Helper to get table_number from table_id
    const tableNumber = await getTableNumber(connection, orderGroup.table_id);
    orderGroup.table_number = tableNumber;
    console.log(`[DEBUG] Assigned table_number to orderGroup:`, orderGroup.table_number);

    // FIXED: Resolve cart conflicts before joining
    await resolveCartConflicts(connection, userId, session_id, orderGroup.restaurant_id, groupId, 'DINE_IN');

    // FIXED: Add participant consistently
    await addGroupParticipant(connection, groupId, userId, session_id);

    // Check if the user already has a cart for this group
    const cartCheckQuery = `
      SELECT * FROM Cart 
      WHERE ${userId ? 'user_id = ?' : 'session_id = ?'} 
      AND restaurant_id = ? 
      AND order_group_id = ? 
      AND is_finalized = 0
    `;
    
    const [cartRows] = await connection.query(
      cartCheckQuery, 
      [userId || session_id, orderGroup.restaurant_id, groupId]
    );

    // If no cart exists, create one
    if (cartRows.length === 0) {
      const createCartQuery = `
        INSERT INTO Cart (
          user_id, 
          session_id,
          restaurant_id, 
          order_group_id, 
          is_finalized,
          created_at,
          updated_at
        ) VALUES (?, ?, ?, ?, 0, NOW(), NOW())
      `;
      
      await connection.query(
        createCartQuery, 
        [userId, session_id, orderGroup.restaurant_id, groupId]
      );
    }

    await connection.commit();

    return res.status(200).json({
      success: true,
      data: {
        message: "Successfully joined the order group.",
        group_id: groupId,
        restaurant_id: orderGroup.restaurant_id
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error joining order group:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to join order group.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Leave an order group
 * @route POST /order-groups/:groupId/leave
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success
 */
router.post("/:groupId/leave", optionalAuthenticateUser, async (req, res) => {
  let connection;
  try {
    const { groupId } = req.params;
    const session_id = req.session.id;
    const userId = req.user ? req.user.userId : null;

    // Validate the group ID
    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: "Group ID is required."
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Delete cart items first to maintain referential integrity
    const deleteCartItemsQuery = `
      DELETE ci FROM CartItems ci
      JOIN Cart c ON ci.cart_id = c.id
      WHERE c.order_group_id = ? AND ${userId ? 'c.user_id = ?' : 'c.session_id = ?'}
    `;
    
    await connection.query(deleteCartItemsQuery, [groupId, userId || session_id]);

    // Delete the cart
    const deleteCartQuery = `
      DELETE FROM Cart 
      WHERE order_group_id = ? AND ${userId ? 'user_id = ?' : 'session_id = ?'}
    `;
    
    await connection.query(deleteCartQuery, [groupId, userId || session_id]);

    await connection.commit();

    return res.status(200).json({
      success: true,
      data: {
        message: "Successfully left the order group."
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error leaving order group:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to leave order group.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Get the status of an order group, including all orders and cart statuses
 * @route GET /order-groups/:groupId/status
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with group status
 */
router.get("/:groupId/status", async (req, res) => {
  try {
    const { groupId } = req.params;

    // Validate the group ID
    if (!groupId) {
      return res.status(400).json({
        success: false,
        error: "Group ID is required."
      });
    }

    // Get the group details
    const getGroupQuery = `
      SELECT 
        og.*,
        r.name as restaurant_name,
        r.address as restaurant_address,
        r.payment_acceptance_type
      FROM OrderGroups og
      JOIN Restaurants r ON og.restaurant_id = r.id
      WHERE og.id = ?
    `;
    
    const groupResult = await db.query(getGroupQuery, [groupId]);

    if (groupResult.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Order group not found."
      });
    }

    const orderGroup = groupResult[0];

    // Helper to get table_number from table_id
    const tableNumber = await getTableNumber(db, orderGroup.table_id);
    orderGroup.table_number = tableNumber;
    console.log(`[DEBUG] Assigned table_number to orderGroup:`, orderGroup.table_number);

    // Get all orders in this group
    const getOrdersQuery = `
      SELECT 
        o.id,
        o.user_id,
        COALESCE(u.name, 'Anonymous') as user_name,
        o.total_amount,
        o.order_status,
        o.payment_status,
        o.created_at
      FROM Orders o
      LEFT JOIN Users u ON o.user_id = u.id
      WHERE o.order_group_id = ?
    `;
    
    const ordersResult = await db.query(getOrdersQuery, [groupId]);

    // For each order, get its items and max prep_time
    let groupExpectedReadyTime = null;
    for (const order of ordersResult) {
      const orderItems = await db.query(
        `SELECT oi.*, i.name as item_name, i.prep_time,
         v.name as variation_name
         FROM OrderItems oi
         JOIN Items i ON oi.item_id = i.id
         LEFT JOIN Variations v ON oi.variation_id = v.id
         WHERE oi.order_id = ?`,
        [order.id]
      );

      // Process addon items for each order item
      for (const item of orderItems) {
        if (item.addon_items) {
          try {
            const addonIds = JSON.parse(item.addon_items).map(addon => addon.id);
            if (addonIds.length > 0) {
              const placeholders = addonIds.map(() => '?').join(',');
              const addonsQuery = `
                SELECT id, name, price
                FROM AddOnItems
                WHERE id IN (${placeholders})
              `;
              const addons = await db.query(addonsQuery, addonIds);
              item.addon_items = addons;
            } else {
              item.addon_items = [];
            }
          } catch (error) {
            console.error("Error parsing addon_items:", error);
            item.addon_items = [];
          }
        } else {
          item.addon_items = [];
        }
      }

      order.items = orderItems;
      // Find max prep_time for this order
      const maxPrepTime = orderItems.reduce((max, item) => {
        const prep = item.prep_time || 15; // default 15 min
        return Math.max(max, prep);
      }, 0);
      order.max_prep_time = maxPrepTime;
      // Calculate expected_ready_time (as ISO string)
      const createdAt = new Date(order.created_at);
      const expectedReady = new Date(createdAt.getTime() + maxPrepTime * 60000);
      order.expected_ready_time = expectedReady.toISOString();
      // Track group max
      if (!groupExpectedReadyTime || expectedReady > groupExpectedReadyTime) {
        groupExpectedReadyTime = expectedReady;
      }
    }

    // Get all pending carts (members who haven't finalized orders)
    const getCartsQuery = `
      SELECT 
        c.id,
        c.user_id,
        COALESCE(u.name, 'Anonymous') as user_name,
        COUNT(ci.id) as item_count,
        SUM(ci.price * ci.quantity) as total_amount
      FROM Cart c
      LEFT JOIN Users u ON c.user_id = u.id
      LEFT JOIN CartItems ci ON c.id = ci.cart_id
      WHERE c.order_group_id = ? AND c.is_finalized = 0
      GROUP BY c.id
    `;
    
    const cartsResult = await db.query(getCartsQuery, [groupId]);

    // Calculate the group total amount from finalized orders
    const totalOrderAmount = ordersResult.reduce(
      (sum, order) => sum + parseFloat(order.total_amount || 0), 
      0
    );

    // Include unfinalized cart amounts in potential total
    const potentialTotalAmount = cartsResult.reduce(
      (sum, cart) => sum + parseFloat(cart.total_amount || 0), 
      totalOrderAmount
    );

    // Add server time for frontend countdown accuracy
    const serverTime = new Date().toISOString();

    // Get the true participant count from GroupParticipants
    const participantCountResult = await db.query(
      'SELECT COUNT(*) as count FROM GroupParticipants WHERE order_group_id = ?',
      [groupId]
    );
    const participantCount = participantCountResult[0]?.count || 0;

    return res.status(200).json({
      success: true,
      data: {
        ...orderGroup,
        location_details: orderGroup.location_details ? JSON.parse(orderGroup.location_details) : null,
        orders: ordersResult,
        pending_carts: cartsResult,
        total_order_amount: totalOrderAmount,
        potential_total_amount: potentialTotalAmount,
        participant_count: participantCount,
        group_expected_ready_time: groupExpectedReadyTime ? groupExpectedReadyTime.toISOString() : null,
        server_time: serverTime
      }
    });
  } catch (error) {
    console.error("Error fetching order group status:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to fetch order group status.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

/**
 * Finalize an order group (typically used by restaurant staff)
 * @route POST /order-groups/:groupId/finalize
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success
 */
router.post("/:groupId/finalize", authenticateUser, async (req, res) => {
  let connection;
  try {
    const { groupId } = req.params;
    const { userId, role } = req.user;

    // Only allow restaurant owners or admins to finalize groups
    if (role !== 'RESTAURANT_OWNER' && role !== 'ADMIN') {
      return res.status(403).json({
        success: false,
        error: "Only restaurant owners or admins can finalize order groups."
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Get the group details
    const getGroupQuery = `
      SELECT * FROM OrderGroups WHERE id = ?
    `;
    
    const [groupRows] = await connection.query(getGroupQuery, [groupId]);

    if (groupRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: "Order group not found."
      });
    }

    const orderGroup = groupRows[0];

    // Helper to get table_number from table_id
    const tableNumber = await getTableNumber(connection, orderGroup.table_id);
    orderGroup.table_number = tableNumber;
    console.log(`[DEBUG] Assigned table_number to orderGroup:`, orderGroup.table_number);

    // For restaurant owners, verify they own this restaurant
    if (role === 'RESTAURANT_OWNER') {
      const verifyOwnerQuery = `
        SELECT * FROM RestaurantOwners 
        WHERE user_id = ? AND restaurant_id = ?
      `;
      
      const [ownerRows] = await connection.query(verifyOwnerQuery, [userId, orderGroup.restaurant_id]);

      if (ownerRows.length === 0) {
        await connection.rollback();
        return res.status(403).json({
          success: false,
          error: "You don't have permission to manage this restaurant."
        });
      }
    }

    // Update the group status to closed
    await updateGroupStatus(connection, groupId, 'closed');

    // Delete any unfinalized carts
    const deleteCartItemsQuery = `
      DELETE ci FROM CartItems ci
      JOIN Cart c ON ci.cart_id = c.id
      WHERE c.order_group_id = ? AND c.is_finalized = 0
    `;
    
    await connection.query(deleteCartItemsQuery, [groupId]);

    const deleteCartsQuery = `
      DELETE FROM Cart 
      WHERE order_group_id = ? AND is_finalized = 0
    `;
    
    await connection.query(deleteCartsQuery, [groupId]);

    await connection.commit();

    return res.status(200).json({
      success: true,
      data: {
        message: "Order group successfully finalized.",
        group_id: groupId
      }
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error finalizing order group:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to finalize order group.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Auto-join or create a group order for a table
 * @route POST /order-groups/auto-join-or-create
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response with group order details
 */
router.post("/auto-join-or-create", optionalAuthenticateUser, async (req, res) => {
  let connection;
  try {
    const { restaurant_id, table_id, session_id } = req.body;
    const user_id = req.user ? req.user.userId : null;

    if (!restaurant_id || !table_id) {
      return res.status(400).json({
        success: false,
        error: "restaurant_id and table_id are required."
      });
    }
    if (!user_id && !session_id) {
      return res.status(400).json({
        success: false,
        error: "Either user authentication or session_id is required."
      });
    }

    connection = await db.getConnection();
    await connection.beginTransaction();

    // Securely map table code (table_number) to numeric table_id
    const [tableRows] = await connection.query(
      'SELECT id FROM RestaurantTables WHERE restaurant_id = ? AND table_number = ? LIMIT 1',
      [restaurant_id, table_id]
    );
    if (tableRows.length === 0) {
      await connection.rollback();
      return res.status(400).json({
        success: false,
        error: `Table '${table_id}' not found for this restaurant.`
      });
    }
    const numericTableId = tableRows[0].id;

    // ENFORCE: Only one active orderGroup per user/session
    const existingGroup = await findActiveOrderGroup(connection, user_id, session_id);
    if (existingGroup) {
      // Check if this group is for the same restaurant and table (numeric ID)
      if (
        existingGroup.restaurant_id == restaurant_id &&
        existingGroup.table_id == numericTableId
      ) {
        // Helper to get table_number from table_id
        const tableNumber = await getTableNumber(connection, existingGroup.table_id);
        existingGroup.table_number = tableNumber;
        // Allow, return group info as success
        await connection.commit();
        return res.status(200).json({
          success: true,
          data: existingGroup
        });
      } else {
        // Block, return error
        await connection.rollback();
        return res.status(409).json({
          error: "active_ordergroup_exists",
          orderGroup: {
            id: existingGroup.id,
            restaurant: existingGroup.restaurant_name,
            group_status: existingGroup.group_status
          }
        });
      }
    }

    // FIXED: Use atomic group creation to handle race conditions
    let groupResult;
    try {
      groupResult = await createOrJoinGroupForTable(connection, restaurant_id, numericTableId, user_id, session_id);
    } catch (error) {
      await connection.rollback();
      return res.status(500).json({
        success: false,
        error: "Failed to create or join group order.",
        details: process.env.NODE_ENV === 'development' ? error.message : undefined
      });
    }

    const groupOrder = {
      id: groupResult.groupId,
      restaurant_id,
      table_id: numericTableId,
      location_type: 'TABLE',
      qr_code: groupResult.qr_code,
      group_status: 'active',
      payment_status: 'pending'
    };

    // Helper to get table_number from table_id
    const tableNumber = await getTableNumber(connection, groupOrder.table_id);
    groupOrder.table_number = tableNumber;
    console.log(`[DEBUG] Assigned table_number to orderGroup:`, groupOrder.table_number);

    // FIXED: Resolve cart conflicts before adding participant
    await resolveCartConflicts(connection, user_id, session_id, restaurant_id, groupResult.groupId, 'DINE_IN');

    // FIXED: Add participant consistently
    await addGroupParticipant(connection, groupResult.groupId, user_id, session_id);

    // Create a cart with retry logic
    try {
      if (user_id) {
        const [existingCart] = await connection.query(
          `SELECT id FROM Cart WHERE user_id = ? AND restaurant_id = ? AND order_group_id = ? AND is_finalized = 0 LIMIT 1`,
          [user_id, restaurant_id, groupOrder.id]
        );
        
        if (existingCart.length === 0) {
          await connection.query(
            `INSERT INTO Cart (user_id, restaurant_id, order_group_id, is_finalized, created_at, updated_at) 
             VALUES (?, ?, ?, 0, NOW(), NOW())`,
            [user_id, restaurant_id, groupOrder.id]
          );
        }
      } else if (session_id) {
        const [existingCart] = await connection.query(
          `SELECT id FROM Cart WHERE session_id = ? AND restaurant_id = ? AND order_group_id = ? AND is_finalized = 0 LIMIT 1`,
          [session_id, restaurant_id, groupOrder.id]
        );
        
        if (existingCart.length === 0) {
          await connection.query(
            `INSERT INTO Cart (session_id, restaurant_id, order_group_id, is_finalized, created_at, updated_at) 
             VALUES (?, ?, ?, 0, NOW(), NOW())`,
            [session_id, restaurant_id, groupOrder.id]
          );
        }
      }
    } catch (error) {
      await connection.rollback();
      if (error.code === 'ER_DUP_ENTRY') {
        // If it's just a duplicate entry error for the cart, we can continue
        console.error("Duplicate cart entry, but continuing:", error);
      } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
        // If the order group reference fails, it means the group was deleted
        return res.status(500).json({
          success: false,
          error: "Failed to create cart - the group order no longer exists."
        });
      } else {
        throw error;
      }
    }

    // Final verification that the group still exists before committing
    const [finalCheck] = await connection.query(
      `SELECT id FROM OrderGroups WHERE id = ?`, 
      [groupOrder.id]
    );
    
    if (finalCheck.length === 0) {
      await connection.rollback();
      return res.status(500).json({
        success: false,
        error: "Group order was deleted during transaction."
      });
    }

    // All operations succeeded, commit the transaction
    await connection.commit();

    // Return the group order info
    return res.status(200).json({
      success: true,
      data: groupOrder
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error in auto-join-or-create group order:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to auto-join or create group order.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Pay/finalize an order group (group-level payment)
 * @route POST /order-groups/:groupId/pay
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success
 */
router.post("/:groupId/pay", authenticateUser, async (req, res) => {
  let connection;
  try {
    const { groupId } = req.params;
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Get the group details
    const [groupRows] = await connection.query(
      `SELECT * FROM OrderGroups WHERE id = ? AND group_status = 'active'`,
      [groupId]
    );
    if (groupRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: "Order group not found or not active."
      });
    }

    // Update group status to pending payment
    await updateGroupStatus(connection, groupId, 'pending_payment');

    await connection.commit();

    // Return updated group info
    const updatedGroupRows = await db.query(
      `SELECT * FROM OrderGroups WHERE id = ?`,
      [groupId]
    );
    return res.status(200).json({
      success: true,
      data: updatedGroupRows[0],
      message: "Group order payment initiated."
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error initiating group payment:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to initiate group payment.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

/**
 * Confirm payment for an order group (mark as paid)
 * @route POST /order-groups/:groupId/confirm-payment
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 * @returns {Object} JSON response indicating success
 */
router.post("/:groupId/confirm-payment", authenticateUser, async (req, res) => {
  let connection;
  try {
    const { groupId } = req.params;
    connection = await db.getConnection();
    await connection.beginTransaction();

    // Get the group details
    const [groupRows] = await connection.query(
      `SELECT * FROM OrderGroups WHERE id = ? AND group_status IN ('in_progress', 'pending_payment')`,
      [groupId]
    );
    if (groupRows.length === 0) {
      await connection.rollback();
      return res.status(404).json({
        success: false,
        error: "Order group not found or not in progress or pending payment."
      });
    }

    // Mark all orders in the group as paid and update their status
    await connection.query(
      `UPDATE Orders SET payment_status = 'SUCCESS', order_status = 'completed', updated_at = NOW() WHERE order_group_id = ?`,
      [groupId]
    );

    // Update group status and payment status
    await updateGroupStatus(connection, groupId, 'closed');
    await connection.query(
      `UPDATE OrderGroups SET payment_status = 'paid', updated_at = NOW() WHERE id = ?`,
      [groupId]
    );

    await connection.commit();

    // Return updated group info
    const updatedGroupRows = await db.query(
      `SELECT * FROM OrderGroups WHERE id = ?`,
      [groupId]
    );
    return res.status(200).json({
      success: true,
      data: updatedGroupRows[0],
      message: "Group order paid and closed successfully."
    });
  } catch (error) {
    if (connection) {
      await connection.rollback();
    }
    console.error("Error confirming group payment:", error);
    return res.status(500).json({
      success: false,
      error: "Failed to confirm group payment.",
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  } finally {
    if (connection) {
      connection.release();
    }
  }
});

// Helper to find active order group for user/session
async function findActiveOrderGroup(connection, userId, sessionId) {
  // Simple approach: Check for user first, then session, but don't overcomplicate
  if (userId) {
    const [groups] = await connection.query(
      `SELECT og.*, r.name as restaurant_name FROM OrderGroups og
       JOIN Restaurants r ON og.restaurant_id = r.id
       JOIN GroupParticipants gp ON gp.order_group_id = og.id
       WHERE og.group_status = 'active' AND gp.user_id = ?
       LIMIT 1`,
      [userId]
    );
    return groups.length > 0 ? groups[0] : null;
  } else if (sessionId) {
    const [groups] = await connection.query(
      `SELECT og.*, r.name as restaurant_name FROM OrderGroups og
       JOIN Restaurants r ON og.restaurant_id = r.id
       JOIN GroupParticipants gp ON gp.order_group_id = og.id
       WHERE og.group_status = 'active' AND gp.session_id = ?
       LIMIT 1`,
      [sessionId]
    );
    return groups.length > 0 ? groups[0] : null;
  }
  return null;
}

// Helper to add group participant consistently
async function addGroupParticipant(connection, groupId, userId, sessionId) {
  try {
    await connection.query(
      `INSERT INTO GroupParticipants (order_group_id, user_id, session_id, joined_at)
       VALUES (?, ?, ?, NOW())
       ON DUPLICATE KEY UPDATE joined_at = NOW()`,
      [groupId, userId, sessionId]
    );
  } catch (error) {
    console.error(`Failed to add participant to group ${groupId}:`, error);
    throw error;
  }
}

// Basic group status update
async function updateGroupStatus(connection, groupId, newStatus) {
  await connection.query(
    `UPDATE OrderGroups SET group_status = ?, updated_at = NOW() WHERE id = ?`,
    [newStatus, groupId]
  );
}

// Simplified cart conflict resolution
async function resolveCartConflicts(connection, userId, sessionId, restaurantId, orderGroupId, orderType = 'DINE_IN') {
  // Simple approach: just clean up any existing carts for this user/session that don't match the current context
  let condition, param;
  if (userId) {
    condition = "user_id = ?";
    param = userId;
  } else if (sessionId) {
    condition = "session_id = ?";
    param = sessionId;
  } else {
    return; // Nothing to clean up
  }
  
  // Get existing carts
  const activeCarts = await connection.query(
    `SELECT id, restaurant_id, order_group_id, order_type FROM Cart 
     WHERE ${condition} AND is_finalized = 0`,
    [param]
  );
  
  // Remove carts that don't match current context
  for (const cart of activeCarts) {
    if (cart.restaurant_id !== parseInt(restaurantId) || 
        cart.order_group_id !== (orderGroupId ? parseInt(orderGroupId) : null) ||
        cart.order_type !== orderType) {
      
      // Delete cart items first
      await connection.query(`DELETE FROM CartItems WHERE cart_id = ?`, [cart.id]);
      // Delete cart
      await connection.query(`DELETE FROM Cart WHERE id = ?`, [cart.id]);
    }
  }
}

// Simplified group creation with basic race condition handling
async function createOrJoinGroupForTable(connection, restaurantId, tableId, userId, sessionId) {
  // Generate QR code
  const { v4: uuidv4 } = require('uuid');
  const qrCode = uuidv4();
  
  try {
    // Try to create new group
    const [result] = await connection.query(
      `INSERT INTO OrderGroups (restaurant_id, table_id, location_type, qr_code, group_status, payment_status, created_at, updated_at) 
       VALUES (?, ?, 'TABLE', ?, 'active', 'pending', NOW(), NOW())`,
      [restaurantId, tableId, qrCode]
    );
    
    return { groupId: result.insertId, isNew: true, qr_code: qrCode };
    
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') {
      // Group already exists for this table, join it
      const [existing] = await connection.query(
        `SELECT id, qr_code FROM OrderGroups 
         WHERE restaurant_id = ? AND table_id = ? AND group_status = 'active'
         LIMIT 1`,
        [restaurantId, tableId]
      );
      
      if (existing.length > 0) {
        return { groupId: existing[0].id, isNew: false, qr_code: existing[0].qr_code };
      }
    }
    throw error;
  }
}

// Helper to get table_number from table_id
async function getTableNumber(connection, table_id) {
  if (!table_id) return null;
  
  try {
    const [rows] = await connection.query(
      `SELECT table_number FROM RestaurantTables WHERE id = ? LIMIT 1`,
      [table_id]
    );
    return rows.length > 0 ? rows[0].table_number : null;
  } catch (err) {
    console.error(`Error getting table number for table_id ${table_id}:`, err.message);
    return null;
  }
}

module.exports = router; 