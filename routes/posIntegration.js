const db = require('../db');
const { PetPoojaError } = require('../services/posAdapters/petpoojaAdapter');
const { getPetpoojaAdapterConfig, createOrUpdatePosIntegration } = require('../services/posConfigService');

// ✅ UPDATED: Use normalized structure
async function createIntegration(data) {
    try {
        // Use normalized structure if provider is specified
        if (data.provider_name) {
            return await createOrUpdatePosIntegration(
                data.restaurant_id, 
                data.provider_name, 
                {
                    pos_restaurant_id: data.pos_restaurant_id,
                    endpoint: data.endpoint,
                    api_key: data.api_key,
                    restaurant_config: data.config,
                    webhook_secret: data.webhook_secret,
                    active: data.active !== false
                }
            );
        }
        
        // Fallback to old structure for backward compatibility
        console.warn('Using legacy createIntegration - consider migrating to normalized structure');
        const [result] = await db.query(
            'INSERT INTO restaurant_pos_integrations (restaurant_id, pos_type, pos_restaurant_id, endpoint, api_key, config) VALUES (?, ?, ?, ?, ?, ?)',
            [data.restaurant_id, data.pos_type, data.pos_restaurant_id, data.endpoint, data.api_key, JSON.stringify(data.config)]
        );
        return result.insertId;
    } catch (error) {
        console.error('Error creating POS integration:', error);
        throw new Error('Failed to create POS integration');
    }
}

// ✅ UPDATED: Use normalized structure
async function updateIntegration(id, data) {
    try {
        // If provider is specified, use normalized approach
        if (data.provider_name && data.restaurant_id) {
            return await createOrUpdatePosIntegration(
                data.restaurant_id,
                data.provider_name,
                {
                    pos_restaurant_id: data.pos_restaurant_id,
                    endpoint: data.endpoint,
                    api_key: data.api_key,
                    restaurant_config: data.config,
                    webhook_secret: data.webhook_secret,
                    active: data.active !== false
                }
            );
        }
        
        // Fallback to old structure
        console.warn('Using legacy updateIntegration - consider migrating to normalized structure');
        await db.query(
            'UPDATE restaurant_pos_integrations SET endpoint = ?, api_key = ?, config = ?, pos_restaurant_id = ? WHERE id = ?',
            [data.endpoint, data.api_key, JSON.stringify(data.config), data.pos_restaurant_id, id]
        );
        return true;
    } catch (error) {
        console.error('Error updating POS integration:', error);
        throw new Error('Failed to update POS integration');
    }
}

async function deactivateIntegration(id) {
    try {
        await db.query(
            'UPDATE restaurant_pos_integrations SET active = 0 WHERE id = ?',
            [id]
        );
        return true;
    } catch (error) {
        console.error('Error deactivating POS integration:', error);
        throw new Error('Failed to deactivate POS integration');
    }
}

module.exports = {
    createIntegration,
    updateIntegration,
    deactivateIntegration
}; 