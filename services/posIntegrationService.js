const db = require('../db');
const { getPetpoojaAdapterConfig } = require('./posConfigService');
const { updateOrderPOSStatus, updateOrderPOSId } = require('../models/order');
const { saveOrder } = require('./posAdapters/petpoojaAdapter');

// Debug utility
const debug = (message, data = null) => {
    console.log(`[POS-DEBUG] ${new Date().toISOString()} - ${message}`);
    if (data) {
        console.log(`[POS-DEBUG] Data:`, JSON.stringify(data, null, 2));
    }
};

// Helper function to get restaurant ID for order
async function getRestaurantIdForOrder(orderId) {
    const conn = await db.getConnection();
    try {
        const [rows] = await conn.query(
            `SELECT o.restaurant_id, r.id as restaurant_id_from_restaurants
             FROM Orders o 
             JOIN Restaurants r ON o.restaurant_id = r.id 
             WHERE o.id = ?`,
            [orderId]
        );
        
        if (!rows[0]) {
            throw new Error(`Order with ID ${orderId} not found`);
        }
        
        return rows[0].restaurant_id_from_restaurants;
    } finally {
        conn.release();
    }
}

// Main function to push order to POS - SIMPLIFIED
async function pushOrderToPOS(orderId, connection = null) {
    debug(`🚀 Starting pushOrderToPOS for order ID: ${orderId}`);
    
    try {
        // Step 1: Get restaurant ID for the order
        debug(`📋 Step 1: Getting restaurant ID for order: ${orderId}`);
        const restaurantId = await getRestaurantIdForOrder(orderId);
        
        debug(`🏪 Restaurant ID found: ${restaurantId}`);

        // Step 2: Get POS integration configuration
        debug(`⚙️ Step 2: Fetching POS configuration for restaurant ID: ${restaurantId}`);
        
        const { integration, config } = await getPetpoojaAdapterConfig(restaurantId);
        
        debug(`⚙️ POS integration found:`, {
            provider_name: integration?.provider_name,
            active: integration?.active,
            pos_restaurant_id: integration?.pos_restaurant_id,
            config_keys: config ? Object.keys(config) : []
        });
        
        if (!integration || !integration.active) {
            debug(`❌ No active POS integration found for restaurant ${restaurantId}`);
            throw new Error('No active POS integration found for restaurant');
        }

        // Step 3: Call POS adapter - let mapper do all the heavy lifting
        debug(`🔌 Step 3: Calling POS adapter for provider: ${integration.provider_name}`);
        
        let response;
        switch (integration.provider_name.toLowerCase()) {
            case 'petpooja':
                debug(`📤 Sending order to PetPooja POS...`);
                
                // Enhanced config with restaurant context
                const enhancedConfig = {
                    ...config,
                    restaurant_id: restaurantId
                };
                
                // Pass minimal data - let mapper fetch and transform everything
                const orderInputData = {
                    order_id: orderId.toString(),
                    callback_url: config.webhook_url || `${process.env.WEBHOOK_BASE_URL || 'https://yourapp.com'}/callback`
                };
                
                response = await saveOrder(enhancedConfig, orderInputData);
                debug(`📥 PetPooja response received:`, {
                    status: response.status,
                    orderId: response.orderId,
                    success: response.data?.success
                });
                break;
            default:
                debug(`❌ Unsupported POS provider: ${integration.provider_name}`);
                throw new Error(`Unsupported POS provider: ${integration.provider_name}`);
        }

        // Step 4: Update order status based on response
        debug(`💾 Step 4: Updating order status in database`);
        
        await updateOrderPOSStatus(
            orderId,
            response.status === 200 ? 'success' : 'failed',
            JSON.stringify(response)
        );

        // Step 5: Update POS order ID in database
        debug(`💾 Step 5: Updating POS order ID in database`);
        
        await updateOrderPOSId(
            orderId,
            response.orderId
        );

        debug(`✅ Order successfully processed! Order ID: ${orderId}, POS Order ID: ${response.orderId}`);
        
        return response;
    } catch (error) {
        debug(`❌ Error in pushOrderToPOS:`, {
            orderId,
            error: error.message,
            stack: error.stack
        });
        
        // Update order status to failed
        await updateOrderPOSStatus(
            orderId,
            'failed',
            JSON.stringify({ error: error.message })
        );
        throw error;
    }
}

module.exports = {
    pushOrderToPOS
}; 