const db = require('../db');

/**
 * Get complete POS configuration for a restaurant
 * Combines provider-level and restaurant-specific configuration
 */
async function getPosConfiguration(restaurantId, providerName) {
    const [result] = await db.query(`
        SELECT 
            rpi.id as integration_id,
            rpi.restaurant_id,
            rpi.pos_restaurant_id,
            rpi.endpoint,
            rpi.api_key,
            rpi.active,
            pp.id as provider_id,
            pp.provider_name,
            pp.display_name,
            pp.base_api_url,
            pp.webhook_base_url,
            pp.webhook_endpoints,
            pp.global_config,
            pp.auth_type,
            rpi.config,
            rpi.restaurant_specific_config,
            rws.secret_key as webhook_secret
        FROM restaurant_pos_integrations rpi
        JOIN pos_providers pp ON rpi.pos_provider_id = pp.id
        LEFT JOIN restaurant_webhook_secrets rws ON rws.restaurant_id = rpi.restaurant_id 
            AND rws.pos_provider_id = rpi.pos_provider_id 
            AND rws.is_active = 1
        WHERE rpi.restaurant_id = ? AND pp.provider_name = ? AND rpi.active = 1
    `, [restaurantId, providerName]);
    
    if (!result) {
        throw new Error(`No active ${providerName} integration found for restaurant ${restaurantId}`);
    }
    
    return result;
}

/**
 * Get POS configuration by POS restaurant ID
 */
async function getPosConfigurationByPosRestaurantId(posRestaurantId, providerName) {
    const [result] = await db.query(`
        SELECT 
            rpi.id as integration_id,
            rpi.restaurant_id,
            rpi.pos_restaurant_id,
            rpi.endpoint,
            rpi.api_key,
            rpi.active,
            pp.id as provider_id,
            pp.provider_name,
            pp.display_name,
            pp.base_api_url,
            pp.webhook_base_url,
            pp.webhook_endpoints,
            pp.global_config,
            pp.auth_type,
            rpi.config,
            rpi.restaurant_specific_config,
            rws.secret_key as webhook_secret
        FROM restaurant_pos_integrations rpi
        JOIN pos_providers pp ON rpi.pos_provider_id = pp.id
        LEFT JOIN restaurant_webhook_secrets rws ON rws.restaurant_id = rpi.restaurant_id 
            AND rws.pos_provider_id = rpi.pos_provider_id 
            AND rws.is_active = 1
        WHERE rpi.pos_restaurant_id = ? AND pp.provider_name = ? AND rpi.active = 1
    `, [posRestaurantId, providerName]);
    
    if (!result) {
        throw new Error(`No active ${providerName} integration found for POS restaurant ${posRestaurantId}`);
    }
    
    return result;
}

/**
 * Get merged configuration for PetPooja adapter
 * Combines provider config + restaurant config into the format expected by existing adapter
 */
async function getPetpoojaAdapterConfig(restaurantId) {
    const config = await getPosConfiguration(restaurantId, 'petpooja');
    
    const globalConfig = config.global_config ? JSON.parse(config.global_config) : {};
    const restaurantConfig = config.restaurant_specific_config ? JSON.parse(config.restaurant_specific_config) : {};
    const legacyConfig = config.config ? JSON.parse(config.config) : {};
    
    // Merge configurations with restaurant-specific taking precedence
    const mergedConfig = {
        // Provider-level defaults
        ...globalConfig,
        
        // Legacy configuration (for backward compatibility)
        ...legacyConfig,
        
        // Restaurant-specific configuration
        ...restaurantConfig,
        
        // Core fields from the integration
        // Use menusharingcode for API calls, not restaurantid
        restID: restaurantConfig.menusharingcode || legacyConfig.menusharingcode || config.pos_restaurant_id,
        
        // API endpoints - prioritize restaurant-specific save_order_endpoint
        save_order_endpoint: restaurantConfig.save_order_endpoint || `${config.base_api_url}/save_order`,
        fetch_menu_endpoint: `${config.base_api_url}/mapped_restaurant_menus`,
        
        // Auth
        api_key: config.api_key,
        
        // Webhook configuration
        webhook_url: config.webhook_base_url,
        webhook_secret: config.webhook_secret,
        
        // Default values if not specified
        udid: restaurantConfig.udid || `web_${Date.now()}`,
        device_type: restaurantConfig.device_type || 'WebClient'
    };
    
    return {
        integration: config,
        config: mergedConfig
    };
}

/**
 * Update restaurant-specific configuration
 */
async function updateRestaurantPosConfig(restaurantId, providerName, newConfig) {
    const config = await getPosConfiguration(restaurantId, providerName);
    
    await db.query(`
        UPDATE restaurant_pos_integrations 
        SET restaurant_specific_config = ?, updated_at = NOW()
        WHERE id = ?
    `, [JSON.stringify(newConfig), config.integration_id]);
    
    return true;
}

/**
 * Create or update POS integration with normalized structure
 */
async function createOrUpdatePosIntegration(restaurantId, providerName, integrationData) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Get provider ID
        const [provider] = await connection.query(
            'SELECT id FROM pos_providers WHERE provider_name = ? AND is_active = 1',
            [providerName]
        );
        
        if (!provider) {
            throw new Error(`Provider ${providerName} not found or inactive`);
        }
        
        // Check if integration exists
        const [existing] = await connection.query(
            'SELECT id FROM restaurant_pos_integrations WHERE restaurant_id = ? AND pos_provider_id = ?',
            [restaurantId, provider.id]
        );
        
        if (existing) {
            // Update existing integration
            await connection.query(`
                UPDATE restaurant_pos_integrations 
                SET pos_restaurant_id = ?, endpoint = ?, api_key = ?, 
                    restaurant_specific_config = ?, active = ?, updated_at = NOW()
                WHERE id = ?
            `, [
                integrationData.pos_restaurant_id,
                integrationData.endpoint,
                integrationData.api_key,
                JSON.stringify(integrationData.restaurant_config || {}),
                integrationData.active !== false ? 1 : 0,
                existing.id
            ]);
        } else {
            // Create new integration
            await connection.query(`
                INSERT INTO restaurant_pos_integrations 
                (restaurant_id, pos_type, pos_provider_id, pos_restaurant_id, endpoint, api_key, restaurant_specific_config, active)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [
                restaurantId,
                providerName,
                provider.id,
                integrationData.pos_restaurant_id,
                integrationData.endpoint,
                integrationData.api_key,
                JSON.stringify(integrationData.restaurant_config || {}),
                integrationData.active !== false ? 1 : 0
            ]);
        }
        
        // Create or update webhook secret if provided
        if (integrationData.webhook_secret) {
            await connection.query(`
                INSERT INTO restaurant_webhook_secrets 
                (restaurant_id, pos_provider_id, secret_key, is_active)
                VALUES (?, ?, ?, 1)
                ON DUPLICATE KEY UPDATE 
                secret_key = VALUES(secret_key), updated_at = NOW()
            `, [restaurantId, provider.id, integrationData.webhook_secret]);
        }
        
        await connection.commit();
        return true;
    } catch (error) {
        await connection.rollback();
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = {
    getPosConfiguration,
    getPosConfigurationByPosRestaurantId,
    getPetpoojaAdapterConfig,
    updateRestaurantPosConfig,
    createOrUpdatePosIntegration
}; 