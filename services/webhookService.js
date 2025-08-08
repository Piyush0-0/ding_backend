const db = require('../db');
const crypto = require('crypto');

/**
 * Get webhook configuration for a restaurant and provider
 */
async function getWebhookConfig(restaurantId, providerName) {
    const [result] = await db.query(`
        SELECT 
            pp.webhook_base_url,
            pp.webhook_endpoints,
            pp.global_config,
            rws.secret_key,
            rpi.restaurant_specific_config
        FROM restaurant_pos_integrations rpi
        JOIN pos_providers pp ON rpi.pos_provider_id = pp.id
        LEFT JOIN restaurant_webhook_secrets rws ON rws.restaurant_id = rpi.restaurant_id 
            AND rws.pos_provider_id = rpi.pos_provider_id 
            AND rws.is_active = 1
        WHERE rpi.restaurant_id = ? AND pp.provider_name = ? AND rpi.active = 1
    `, [restaurantId, providerName]);
    
    return result;
}

/**
 * Get webhook configuration by POS restaurant ID
 */
async function getWebhookConfigByPosRestaurantId(posRestaurantId, providerName) {
    const [result] = await db.query(`
        SELECT 
            rpi.restaurant_id,
            pp.webhook_base_url,
            pp.webhook_endpoints,
            pp.global_config,
            rws.secret_key,
            rpi.restaurant_specific_config
        FROM restaurant_pos_integrations rpi
        JOIN pos_providers pp ON rpi.pos_provider_id = pp.id
        LEFT JOIN restaurant_webhook_secrets rws ON rws.restaurant_id = rpi.restaurant_id 
            AND rws.pos_provider_id = rpi.pos_provider_id 
            AND rws.is_active = 1
        WHERE rpi.pos_restaurant_id = ? AND pp.provider_name = ? AND rpi.active = 1
    `, [posRestaurantId, providerName]);
    
    return result;
}

/**
 * Verify webhook signature using restaurant-specific secret
 */
async function verifyWebhookSignature(payload, signature, posRestaurantId, providerName) {
    try {
        const config = await getWebhookConfigByPosRestaurantId(posRestaurantId, providerName);
        
        if (!config || !config.secret_key) {
            throw new Error('No webhook secret found for restaurant');
        }
        
        const expectedSignature = crypto
            .createHmac('sha256', config.secret_key)
            .update(JSON.stringify(payload))
            .digest('hex');
        
        return signature === `sha256=${expectedSignature}`;
    } catch (error) {
        console.error('Webhook signature verification failed:', error);
        return false;
    }
}

/**
 * Get all webhook endpoints for a provider
 */
async function getProviderWebhookEndpoints(providerName) {
    const [result] = await db.query(`
        SELECT webhook_base_url, webhook_endpoints, global_config
        FROM pos_providers 
        WHERE provider_name = ? AND is_active = 1
    `, [providerName]);
    
    if (!result) {
        throw new Error(`Provider ${providerName} not found or inactive`);
    }
    
    const endpoints = {};
    const webhookEndpoints = JSON.parse(result.webhook_endpoints);
    
    for (const [key, path] of Object.entries(webhookEndpoints)) {
        endpoints[key] = result.webhook_base_url + path;
    }
    
    return {
        endpoints,
        config: JSON.parse(result.global_config)
    };
}

/**
 * Rotate webhook secret for a restaurant
 */
async function rotateWebhookSecret(restaurantId, providerName) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Get provider ID
        const [provider] = await connection.query(
            'SELECT id FROM pos_providers WHERE provider_name = ?',
            [providerName]
        );
        
        if (!provider) {
            throw new Error(`Provider ${providerName} not found`);
        }
        
        // Deactivate old secret
        await connection.query(`
            UPDATE restaurant_webhook_secrets 
            SET is_active = 0 
            WHERE restaurant_id = ? AND pos_provider_id = ? AND is_active = 1
        `, [restaurantId, provider.id]);
        
        // Create new secret
        const newSecret = crypto.randomBytes(32).toString('hex');
        
        await connection.query(`
            INSERT INTO restaurant_webhook_secrets 
            (restaurant_id, pos_provider_id, secret_key, expires_at) 
            VALUES (?, ?, ?, DATE_ADD(NOW(), INTERVAL 1 YEAR))
        `, [restaurantId, provider.id, newSecret]);
        
        await connection.commit();
        
        return newSecret;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    getWebhookConfig,
    getWebhookConfigByPosRestaurantId,
    verifyWebhookSignature,
    getProviderWebhookEndpoints,
    rotateWebhookSecret
}; 