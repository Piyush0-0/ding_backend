const db = require('../../db');

// Order status mapping from PetPooja to internal status
const STATUS_MAPPING = {
    'CONFIRMED': 'confirmed',
    'PREPARING': 'preparing', 
    'READY': 'ready',
    'DISPATCHED': 'dispatched',
    'DELIVERED': 'delivered',
    'CANCELLED': 'cancelled',
    'REJECTED': 'rejected'
};

/**
 * Handle order status update from PetPooja webhook
 */
async function updateOrderStatus({ order_id, status, pos_order_id, timestamp, restaurant_id }) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Find the order by external order ID or POS order ID
        const [orderRows] = await connection.query(
            `SELECT id, status as current_status 
             FROM Orders 
             WHERE (id = ? OR pos_order_id = ?) 
             AND restaurant_id = ?`,
            [order_id, pos_order_id, restaurant_id]
        );
        
        if (orderRows.length === 0) {
            throw new Error(`Order not found: ${order_id}`);
        }
        
        const order = orderRows[0];
        const internalStatus = STATUS_MAPPING[status] || status.toLowerCase();
        
        // Update order status
        await connection.query(
            `UPDATE Orders 
             SET status = ?, pos_order_id = ?, pos_status_updated_at = ?, updated_at = NOW()
             WHERE id = ?`,
            [internalStatus, pos_order_id, new Date(timestamp), order.id]
        );
        
        // Log status change
        await connection.query(
            `INSERT INTO OrderStatusHistory 
             (order_id, old_status, new_status, changed_by, change_reason, created_at)
             VALUES (?, ?, ?, 'petpooja_webhook', 'POS status update', NOW())`,
            [order.id, order.current_status, internalStatus]
        );
        
        // Handle specific status actions
        await handleStatusSpecificActions(connection, order.id, internalStatus, {
            pos_order_id,
            timestamp
        });
        
        await connection.commit();
        
        console.log(`Order ${order_id} status updated to ${internalStatus}`);
        
        return {
            success: true,
            orderId: order.id,
            oldStatus: order.current_status,
            newStatus: internalStatus
        };
        
    } catch (error) {
        await connection.rollback();
        console.error('Error updating order status:', error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Handle status-specific business logic
 */
async function handleStatusSpecificActions(connection, orderId, status, metadata) {
    switch (status) {
        case 'confirmed':
            // Send confirmation SMS/notification to customer
            await notifyCustomer(connection, orderId, 'order_confirmed');
            break;
            
        case 'preparing':
            // Update estimated preparation time
            await updateEstimatedTime(connection, orderId, metadata);
            break;
            
        case 'ready':
            // Notify customer for pickup or notify delivery partner
            await notifyCustomer(connection, orderId, 'order_ready');
            break;
            
        case 'dispatched':
            // Send tracking information
            await notifyCustomer(connection, orderId, 'order_dispatched');
            break;
            
        case 'delivered':
            // Mark order as completed, trigger payment completion
            await completeOrder(connection, orderId);
            break;
            
        case 'cancelled':
        case 'rejected':
            // Handle cancellation, initiate refund if needed
            await handleOrderCancellation(connection, orderId, status);
            break;
    }
}

/**
 * Send notification to customer
 */
async function notifyCustomer(connection, orderId, notificationType) {
    try {
        // Get order and customer details
        const [orderRows] = await connection.query(
            `SELECT o.*, u.phone_number, u.email, u.name as customer_name
             FROM Orders o
             JOIN Users u ON o.user_id = u.id
             WHERE o.id = ?`,
            [orderId]
        );
        
        if (orderRows.length === 0) return;
        
        const order = orderRows[0];
        
        // TODO: Implement your notification service (SMS, email, push notification)
        console.log(`Sending ${notificationType} notification to ${order.customer_name} for order ${orderId}`);
        
        // Example: Queue notification for processing
        await connection.query(
            `INSERT INTO NotificationQueue 
             (user_id, order_id, type, phone_number, email, status, created_at)
             VALUES (?, ?, ?, ?, ?, 'pending', NOW())`,
            [order.user_id, orderId, notificationType, order.phone_number, order.email]
        );
        
    } catch (error) {
        console.error('Error sending customer notification:', error);
        // Don't throw - notification failure shouldn't stop order processing
    }
}

/**
 * Update estimated preparation/delivery time
 */
async function updateEstimatedTime(connection, orderId, metadata) {
    try {
        // Calculate new ETA based on POS feedback
        const estimatedMinutes = 30; // This should come from PetPooja webhook data
        const estimatedTime = new Date(Date.now() + estimatedMinutes * 60000);
        
        await connection.query(
            'UPDATE Orders SET estimated_delivery_time = ? WHERE id = ?',
            [estimatedTime, orderId]
        );
        
    } catch (error) {
        console.error('Error updating estimated time:', error);
    }
}

/**
 * Complete order processing
 */
async function completeOrder(connection, orderId) {
    try {
        await connection.query(
            `UPDATE Orders 
             SET completed_at = NOW(), payment_status = 'completed'
             WHERE id = ? AND payment_status != 'failed'`,
            [orderId]
        );
        
        // TODO: Trigger any post-delivery actions (loyalty points, review requests, etc.)
        console.log(`Order ${orderId} marked as completed`);
        
    } catch (error) {
        console.error('Error completing order:', error);
    }
}

/**
 * Handle order cancellation
 */
async function handleOrderCancellation(connection, orderId, reason) {
    try {
        await connection.query(
            `UPDATE Orders 
             SET cancelled_at = NOW(), cancellation_reason = ?
             WHERE id = ?`,
            [reason, orderId]
        );
        
        // TODO: Initiate refund process if payment was completed
        // TODO: Send cancellation notification to customer
        
        console.log(`Order ${orderId} cancelled: ${reason}`);
        
    } catch (error) {
        console.error('Error handling order cancellation:', error);
    }
}

/**
 * Handle menu update webhook from PetPooja (PUSH operation)
 */
async function handleMenuUpdate(payload) {
    console.log('PetPooja push menu webhook received:', payload);
    
    // Extract restaurant ID from the payload
    const restaurants = payload.restaurants || [];
    if (restaurants.length === 0) {
        throw new Error('No restaurant data in push menu payload');
    }
    
    const restaurantData = restaurants[0]; // Assuming single restaurant per webhook
    const restaurantId = restaurantData.restaurantid;
    
    // Find our internal restaurant ID
    const db = require('../../db');
    const [restaurantRows] = await db.query(
        `SELECT r.id as internal_id 
         FROM Restaurants r
         JOIN restaurant_pos_integrations rpi ON r.id = rpi.restaurant_id
         WHERE rpi.pos_type = 'petpooja' 
         AND rpi.active = 1
         AND (
             JSON_UNQUOTE(JSON_EXTRACT(rpi.config, '$.restID')) = ?
             OR rpi.pos_restaurant_id = ?
         )`,
        [restaurantId, restaurantId]
    );
    
    if (restaurantRows.length === 0) {
        throw new Error(`Restaurant not found for restID: ${restaurantId}`);
    }
    
    const internalRestaurantId = restaurantRows[0].internal_id;
    
    // Process the push menu data using the same sync logic but with payload instead of API fetch
    const { processPushMenuData } = require('../menuSyncService');
    await processPushMenuData(internalRestaurantId, payload);
    
    return { 
        success: "1", 
        message: "Menu items are successfully listed." 
    };
}

/**
 * Handle inventory update webhook from PetPooja
 */
async function handleInventoryUpdate(payload) {
    const { restaurant_id, item_id, availability, timestamp } = payload;
    
    console.log('PetPooja inventory webhook:', payload);
    
    const db = require('../../db');
    
    // Update item availability
    await db.query(
        'UPDATE Items SET in_stock = ? WHERE external_id = ? AND restaurant_id = ?',
        [availability ? 1 : 0, item_id, restaurant_id]
    );
    
    return { success: true, message: 'Inventory updated' };
}

/**
 * Handle stock update webhook from PetPooja (uses dedicated stock handler)
 */
async function handleStockUpdate(payload) {
    const { restID, type, inStock, itemID } = payload;
    
    console.log('PetPooja stock update webhook received:', payload);
    
    // Validate required fields
    if (!restID || !type || inStock === undefined || !itemID || !Array.isArray(itemID)) {
        throw new Error('Missing required fields: restID, type, inStock, itemID');
    }

    // Validate type
    if (!['item', 'addon'].includes(type)) {
        throw new Error('Invalid type. Must be "item" or "addon"');
    }

    // Use dedicated stock handler for complex stock update logic
    const { handleStockUpdate: processStockUpdate } = require('./petpoojaStockHandler');
    
    const result = await processStockUpdate({
        restaurant_id: restID,
        type,
        in_stock: inStock,
        item_ids: itemID,
        fullPayload: payload
    });
    
    return result;
}

/**
 * Handle store status request from PetPooja
 */
async function handleStoreStatus(payload) {
    const { restID } = payload;
    
    console.log('PetPooja get store status request:', payload);
    
    // Validate required fields
    if (!restID) {
        const error = new Error('Missing required field: restID');
        error.statusCode = 400;
        error.responseFormat = {
            http_code: 400,
            status: "error", 
            store_status: false,
            message: "Missing required field: restID"
        };
        throw error;
    }

    const db = require('../../db');

    // Find restaurant via POS integration config
    const restaurantQuery = `
        SELECT r.id, r.name, r.is_active 
        FROM Restaurants r
        JOIN restaurant_pos_integrations rpi ON r.id = rpi.restaurant_id
        WHERE rpi.pos_type = 'petpooja' 
        AND rpi.active = 1
        AND (
            JSON_UNQUOTE(JSON_EXTRACT(rpi.config, '$.restID')) = ?
            OR rpi.pos_restaurant_id = ?
        )
    `;
    const restaurantRows = await db.query(restaurantQuery, [restID, restID]);
    
    if (restaurantRows.length === 0) {
        const error = new Error('Restaurant not found');
        error.statusCode = 404;
        error.responseFormat = {
            http_code: 404,
            status: "error", 
            store_status: false,
            message: "Restaurant not found"
        };
        throw error;
    }
    
    const restaurant = restaurantRows[0];
    const isActive = restaurant.is_active === 1;
    
    return {
        http_code: 200,
        status: "success",
        store_status: isActive,
        message: "Store status fetched successfully"
    };
}

/**
 * Handle store delivery status request from PetPooja (alternative format)
 */
async function handleStoreDeliveryStatus(payload) {
    const { restID } = payload;
    
    console.log('PetPooja get store delivery status request:', payload);
    
    // Validate required fields
    if (!restID) {
        const error = new Error('Missing required field: restID');
        error.statusCode = 400;
        error.responseFormat = {
            http_code: "400",
            status: "error", 
            store_status: "0",
            message: "Missing required field: restID"
        };
        throw error;
    }

    const db = require('../../db');

    // Find restaurant via POS integration config
    const restaurantQuery = `
        SELECT r.id, r.name, r.is_active 
        FROM Restaurants r
        JOIN restaurant_pos_integrations rpi ON r.id = rpi.restaurant_id
        WHERE rpi.pos_type = 'petpooja' 
        AND rpi.active = 1
        AND (
            JSON_UNQUOTE(JSON_EXTRACT(rpi.config, '$.restID')) = ?
            OR rpi.pos_restaurant_id = ?
        )
    `;
    const restaurantRows = await db.query(restaurantQuery, [restID, restID]);
    
    if (restaurantRows.length === 0) {
        const error = new Error('Restaurant not found');
        error.statusCode = 404;
        error.responseFormat = {
            http_code: "404",
            status: "error", 
            store_status: "0",
            message: "Restaurant not found"
        };
        throw error;
    }
    
    const restaurant = restaurantRows[0];
    const isActive = restaurant.is_active === 1;
    
    return {
        http_code: "200",
        status: "success",
        store_status: isActive ? "1" : "0",
        message: "Store Delivery Status fetched successfully"
    };
}

/**
 * Handle update store status request from PetPooja
 */
async function handleUpdateStoreStatus(payload) {
    const { restID, store_status, turn_on_time, reason } = payload;
    
    console.log('PetPooja update store status request:', payload);
    
    // Validate required fields
    if (!restID) {
        const error = new Error('Missing required field: restID');
        error.statusCode = 400;
        error.responseFormat = {
            http_code: 400,
            status: "error",
            message: "Missing required field: restID"
        };
        throw error;
    }

    if (store_status === undefined || store_status === null) {
        const error = new Error('Missing required field: store_status');
        error.statusCode = 400;
        error.responseFormat = {
            http_code: 400,
            status: "error",
            message: "Missing required field: store_status"
        };
        throw error;
    }

    if (!turn_on_time) {
        const error = new Error('Missing required field: turn_on_time');
        error.statusCode = 400;
        error.responseFormat = {
            http_code: 400,
            status: "error",
            message: "Missing required field: turn_on_time"
        };
        throw error;
    }

    const db = require('../../db');
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Find restaurant via POS integration config
        const restaurantQuery = `
            SELECT r.id, r.name, r.is_active 
            FROM Restaurants r
            JOIN restaurant_pos_integrations rpi ON r.id = rpi.restaurant_id
            WHERE rpi.pos_type = 'petpooja' 
            AND rpi.active = 1
            AND (
                JSON_UNQUOTE(JSON_EXTRACT(rpi.config, '$.restID')) = ?
                OR rpi.pos_restaurant_id = ?
            )
        `;
        const [restaurantRows] = await connection.query(restaurantQuery, [restID, restID]);
        
        if (restaurantRows.length === 0) {
            const error = new Error('Restaurant not found');
            error.statusCode = 404;
            error.responseFormat = {
                http_code: 404,
                status: "error",
                message: "Restaurant not found"
            };
            throw error;
        }
        
        const restaurant = restaurantRows[0];
        const newStatus = parseInt(store_status) === 1 ? 1 : 0;
        
        // Parse turn_on_time if provided (format: "2023-02-17 00:00:00")
        let turnOnDateTime = null;
        if (turn_on_time && turn_on_time.trim() !== '') {
            try {
                turnOnDateTime = new Date(turn_on_time);
                if (isNaN(turnOnDateTime.getTime())) {
                    throw new Error('Invalid date format');
                }
            } catch (dateError) {
                const error = new Error('Invalid turn_on_time format. Expected: YYYY-MM-DD HH:MM:SS');
                error.statusCode = 400;
                error.responseFormat = {
                    http_code: 400,
                    status: "error",
                    message: "Invalid turn_on_time format. Expected: YYYY-MM-DD HH:MM:SS"
                };
                throw error;
            }
        }

        // Update restaurant status
        const updateQuery = `
            UPDATE Restaurants 
            SET is_active = ?, 
                pos_turn_on_time = ?, 
                pos_status_reason = ?,
                updated_at = NOW()
            WHERE id = ?
        `;
        await connection.query(updateQuery, [newStatus, turnOnDateTime, reason || null, restaurant.id]);
        
        // Log the status change for audit purposes
        await connection.query(
            `INSERT INTO restaurant_status_history 
             (restaurant_id, old_status, new_status, turn_on_time, reason, changed_by, created_at)
             VALUES (?, ?, ?, ?, ?, 'petpooja_webhook', NOW())`,
            [restaurant.id, restaurant.is_active, newStatus, turnOnDateTime, reason || null]
        );
        
        await connection.commit();
        
        console.log(`Restaurant ${restID} status updated to ${newStatus ? 'active' : 'inactive'}`);
        
        return {
            http_code: 200,
            status: "success",
            message: `Store Status updated successfully for store ${restID}`
        };
        
    } catch (error) {
        await connection.rollback();
        console.error('Error updating store status:', error);
        
        // If it's already a formatted error, re-throw it
        if (error.responseFormat && error.statusCode) {
            throw error;
        }
        
        // Otherwise, create a generic error response
        const genericError = new Error('Failed to update store status');
        genericError.statusCode = 500;
        genericError.responseFormat = {
            http_code: 500,
            status: "error",
            message: "Failed to update store status"
        };
        throw genericError;
        
    } finally {
        connection.release();
    }
}

/**
 * Handle item/addon stock update request from PetPooja
 * Supports both in-stock and out-of-stock operations with auto turn-on time
 */
async function handleItemStockUpdate(payload) {
    const { restID, type, inStock, itemID, autoTurnOnTime, customTurnOnTime } = payload;
    
    console.log('PetPooja item stock update request:', payload);
    
    // Validate required fields
    if (!restID) {
        throw new Error('Missing required field: restID');
    }

    if (!type || !['item', 'addon'].includes(type)) {
        throw new Error('Invalid or missing type. Must be "item" or "addon"');
    }

    if (inStock === undefined || inStock === null) {
        throw new Error('Missing required field: inStock');
    }

    if (!itemID || !Array.isArray(itemID) || itemID.length === 0) {
        throw new Error('Missing or invalid itemID array');
    }

    const db = require('../../db');
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();

        // Find restaurant via POS integration config
        const restaurantQuery = `
            SELECT r.id, r.name 
            FROM Restaurants r
            JOIN restaurant_pos_integrations rpi ON r.id = rpi.restaurant_id
            WHERE rpi.pos_type = 'petpooja' 
            AND rpi.active = 1
            AND (
                JSON_UNQUOTE(JSON_EXTRACT(rpi.config, '$.restID')) = ?
                OR rpi.pos_restaurant_id = ?
            )
        `;
        const [restaurantRows] = await connection.query(restaurantQuery, [restID, restID]);
        
        if (restaurantRows.length === 0) {
            throw new Error(`Restaurant not found for restID: ${restID}`);
        }
        
        const restaurant = restaurantRows[0];
        let updatedCount = 0;
        let notFoundItems = [];

        if (type === 'item') {
            // Update items stock status
            for (const external_id of itemID) {
                const [result] = await connection.query(
                    `UPDATE Items 
                     SET is_active = ?, 
                         updated_at = NOW() 
                     WHERE external_id = ? AND restaurant_id = ?`,
                    [inStock ? 1 : 0, external_id, restaurant.id]
                );
                
                if (result.affectedRows > 0) {
                    updatedCount++;
                    console.log(`✅ Updated item stock: external_id=${external_id}, is_active=${inStock}`);
                } else {
                    notFoundItems.push(external_id);
                    console.warn(`⚠️ Item not found: external_id=${external_id}, restaurant_id=${restaurant.id}`);
                }
            }
        } else if (type === 'addon') {
            // Update addon items stock status
            for (const external_id of itemID) {
                // First, get the addon and its restaurant through the addon group
                const [addonRows] = await connection.query(
                    `SELECT ai.id, ag.restaurant_id, ai.is_active 
                     FROM AddOnItems ai 
                     JOIN AddOnGroups ag ON ai.addon_group_id = ag.id 
                     WHERE ai.external_id = ? AND ag.restaurant_id = ?`,
                    [external_id, restaurant.id]
                );
                
                if (addonRows.length > 0) {
                    const addon = addonRows[0];
                    
                    const [result] = await connection.query(
                        `UPDATE AddOnItems 
                         SET is_active = ?, 
                             updated_at = NOW() 
                         WHERE external_id = ? AND id = ?`,
                        [inStock ? 1 : 0, external_id, addon.id]
                    );
                    
                    if (result.affectedRows > 0) {
                        updatedCount++;
                        console.log(`✅ Updated addon stock: external_id=${external_id}, is_active=${inStock}`);
                    }
                } else {
                    notFoundItems.push(external_id);
                    console.warn(`⚠️ Addon not found: external_id=${external_id}, restaurant_id=${restaurant.id}`);
                }
            }
        }

        // Log the webhook processing (if WebhookLogs table exists)
        try {
            await connection.query(
                `INSERT INTO WebhookLogs 
                 (webhook_type, payload, status, error_message, processed_at)
                 VALUES ('petpooja_item_stock_update', ?, ?, ?, NOW())`,
                [
                    JSON.stringify({
                        ...payload,
                        processing_notes: {
                            updated_count: updatedCount,
                            not_found_items: notFoundItems,
                            restaurant_internal_id: restaurant.id
                        }
                    }),
                    notFoundItems.length === 0 ? 'success' : 'partial_success',
                    notFoundItems.length > 0 ? `Items not found: ${notFoundItems.join(', ')}` : null
                ]
            );
        } catch (logError) {
            console.warn(`⚠️ Could not log webhook (table may not exist): ${logError.message}`);
        }

        await connection.commit();
        
        console.log(`✅ Item stock update completed: ${updatedCount} ${type}(s) updated, ${notFoundItems.length} not found`);
        
        // Return PetPooja expected response format
        return {
            code: 200,
            status: "success",
            message: "Stock status updated successfully"
        };
        
    } catch (error) {
        await connection.rollback();
        console.error('Error updating item stock status:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    updateOrderStatus,
    handleMenuUpdate,
    handleInventoryUpdate,
    handleStockUpdate,
    handleStoreStatus,
    handleStoreDeliveryStatus,
    handleUpdateStoreStatus,
    handleItemStockUpdate
}; 