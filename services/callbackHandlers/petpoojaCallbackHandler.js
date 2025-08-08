const db = require('../../db');

/**
 * Handle PetPooja callback processing
 * Note: orderID in callback is our internal order ID, not POS order ID
 */
async function handlePetPoojaCallback({
    restaurant_id,
    order_id,
    status,
    cancel_reason,
    minimum_prep_time,
    minimum_delivery_time,
    rider_name,
    rider_phone_number,
    is_modified,
    fullPayload
}) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Validate input parameters
        if (!restaurant_id || !order_id || status === undefined) {
            throw new Error(`Missing required callback parameters: restaurant_id=${restaurant_id}, order_id=${order_id}, status=${status}`);
        }
        
        // Map PetPooja status codes to internal statuses
        const statusMapping = {
            '-1': 'cancelled',     // Order cancelled
            '1': 'confirmed',      // Order accepted
            '2': 'confirmed',      // Order accepted
            '3': 'confirmed',      // Order accepted
            '4': 'dispatched',     // Order dispatched
            '5': 'ready',          // Food ready
            '10': 'delivered'      // Order delivered
        };
        
        const internalStatus = statusMapping[status];
        if (!internalStatus) {
            console.warn(`Unknown PetPooja status code: ${status}, defaulting to 'pending'`);
        }
        const finalStatus = internalStatus || 'pending';
        
        // Find the order by internal order ID and restaurant ID
        // orderID in callback is our internal order.id (sent as string)
        
        let orderRows;
        
        // Check if order_id looks like a formatted order number (contains letters)
        if (/[A-Za-z]/.test(order_id)) {
            // Formatted order number like "A-1"
            [orderRows] = await connection.query(
            `SELECT id, order_status as current_status 
                 FROM Orders 
                 WHERE order_number = ? AND restaurant_id = ?`,
            [order_id, restaurant_id]
        );
            console.log(`Looking up order by order_number: ${order_id}`);
        } else {
            // Integer order ID like "1", "2", "3"
            [orderRows] = await connection.query(
                `SELECT id, order_status as current_status 
                 FROM Orders 
                 WHERE id = ? AND restaurant_id = ?`,
                [parseInt(order_id), restaurant_id]
            );
            console.log(`Looking up order by internal id: ${order_id}`);
        }
        
        if (orderRows.length === 0) {
            const errorMsg = `Order not found for order_id: ${order_id}, restaurant_id: ${restaurant_id}`;
            console.error(errorMsg);
            
            // Log the failed lookup for debugging
            await connection.query(
                `INSERT INTO WebhookLogs 
                 (webhook_type, payload, status, error_message, processed_at)
                 VALUES ('petpooja_callback', ?, 'failed', ?, NOW())`,
                [JSON.stringify(fullPayload), errorMsg]
            );
            
            await connection.rollback();
            return {
                success: false,
                message: 'Order not found',
                error_code: 'ORDER_NOT_FOUND'
            };
        }
        
        const order = orderRows[0];
        
        // Prevent duplicate processing of same status
        if (order.current_status === finalStatus) {
            console.log(`Order ${order_id} already has status ${finalStatus}, skipping update`);
            await connection.rollback();
            return {
                success: true,
                message: 'Status already current',
                orderId: order.id,
                status: finalStatus
            };
        }
        
        // Update order with callback information
        const updateFields = ['order_status = ?', 'pos_status_updated_at = NOW()', 'updated_at = NOW()'];
        const updateValues = [finalStatus];
        
        // Add optional fields if provided
        if (cancel_reason && finalStatus === 'cancelled') {
            updateFields.push('cancellation_reason = ?');
            updateValues.push(cancel_reason);
            updateFields.push('cancelled_at = NOW()');
        }
        
        if (minimum_prep_time && parseInt(minimum_prep_time) > 0) {
            const prepTime = new Date(Date.now() + parseInt(minimum_prep_time) * 60000);
            updateFields.push('estimated_delivery_time = ?');
            updateValues.push(prepTime);
        }
        
        if (finalStatus === 'delivered') {
            updateFields.push('completed_at = NOW()');
        }
        
        updateValues.push(order.id);
        
        // Update the order
        await connection.query(
            `UPDATE Orders SET ${updateFields.join(', ')} WHERE id = ?`,
            updateValues
        );
        
        // Log the status change in OrderStatusHistory
        await connection.query(
            `INSERT INTO OrderStatusHistory 
             (order_id, old_status, new_status, changed_by, change_reason, created_at)
             VALUES (?, ?, ?, 'petpooja_callback', ?, NOW())`,
            [order.id, order.current_status, finalStatus, `PetPooja callback status update: ${status}`]
        );
        
        // Store rider information if provided
        if (rider_name || rider_phone_number) {
            console.log(`Delivery assigned - Rider: ${rider_name}, Phone: ${rider_phone_number}`);
            // TODO: Store rider info in a delivery_details table if needed
        }
        
        // Log the successful callback
        await connection.query(
            `INSERT INTO WebhookLogs 
             (webhook_type, payload, status, processed_at)
             VALUES ('petpooja_callback', ?, 'success', NOW())`,
            [JSON.stringify({
                ...fullPayload,
                processing_notes: {
                    order_found: true,
                    status_changed: order.current_status !== finalStatus,
                    old_status: order.current_status,
                    new_status: finalStatus
                }
            })]
        );
        
        await connection.commit();
        
        console.log(`✅ Order ${order_id} (internal ID) status updated: ${order.current_status} → ${finalStatus}`);
        
        return {
            success: true,
            orderId: order.id,
            oldStatus: order.current_status,
            newStatus: finalStatus,
            message: 'Status updated successfully'
        };
        
    } catch (error) {
        await connection.rollback();
        
        // Log the failed callback with detailed error info
        try {
            await connection.query(
                `INSERT INTO WebhookLogs 
                 (webhook_type, payload, status, error_message, processed_at)
                 VALUES ('petpooja_callback', ?, 'failed', ?, NOW())`,
                [JSON.stringify(fullPayload), `${error.name}: ${error.message}`]
            );
        } catch (logError) {
            console.error('Failed to log callback error:', logError);
        }
        
        console.error(`❌ Error processing PetPooja callback for order ${order_id}:`, error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    handlePetPoojaCallback
}; 