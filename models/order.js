const db = require('../db');

// Update POS push status, response, and time for an order
async function updateOrderPOSStatus(orderId, status, response) {
    await db.query(
        'UPDATE Orders SET pos_push_status = ?, pos_push_response = ?, pos_push_time = NOW() WHERE id = ?',
        [status, response, orderId]
    );
}

// Update POS order ID when order is successfully sent to POS
async function updateOrderPOSId(orderId, posOrderId) {
    await db.query(
        'UPDATE Orders SET pos_order_id = ? WHERE id = ?',
        [posOrderId, orderId]
    );
}

module.exports = {
    updateOrderPOSStatus,
    updateOrderPOSId
}; 