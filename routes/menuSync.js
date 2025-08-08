const express = require('express');
const router = express.Router();
const { syncMenu, MenuSyncError } = require('../services/menuSyncService');
const db = require('../db');
const { fetchMenu } = require('../services/posAdapters/petpoojaAdapter');

// Sync menu for a restaurant by external ID
router.post('/external/:externalRestaurantId', async (req, res) => {
    const { externalRestaurantId } = req.params;
    const { integration_config } = req.body;

    if (!integration_config) {
        return res.status(400).json({
            success: false,
            message: 'Integration configuration is required',
            code: 'MISSING_CONFIG'
        });
    }

    try {
        // Start transaction
        const connection = await db.getConnection();
        await connection.beginTransaction();

        try {
            // Check if restaurant exists with this external ID
            const [existingRestaurants] = await connection.query(
                'SELECT id FROM Restaurants WHERE external_id = ?',
                [externalRestaurantId]
            );

            let restaurantId;
            if (existingRestaurants.length === 0) {
                // Fetch menu to get restaurant details
                const menuData = await fetchMenu({
                    ...integration_config,
                    restID: externalRestaurantId
                });

                if (!menuData.data || !menuData.data.success === '1' || !menuData.data.restaurants?.[0]) {
                    throw new MenuSyncError('Invalid menu data received', 'INVALID_MENU_DATA');
                }

                const restaurantData = menuData.data.restaurants[0];

                // Create new restaurant
                const [result] = await connection.query(
                    `INSERT INTO Restaurants (
                        external_id, name, address, contact, latitude, longitude,
                        minimum_order_amount, minimum_prep_time, delivery_charge,
                        packaging_charge, menu_sharing_code
                    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [
                        externalRestaurantId,
                        restaurantData.res_name,
                        restaurantData.address,
                        restaurantData.contact_information,
                        restaurantData.latitude,
                        restaurantData.longitude,
                        restaurantData.minimumorderamount || 0,
                        restaurantData.minimumdeliverytime ? parseInt(restaurantData.minimumdeliverytime) : 30,
                        restaurantData.deliverycharge || 0,
                        0, // packaging_charge
                        restaurantData.menusharingcode
                    ]
                );
                restaurantId = result.insertId;
            } else {
                restaurantId = existingRestaurants[0].id;
            }

            // Create or update POS integration
            await connection.query(
                `INSERT INTO RestaurantPosIntegrations (
                    restaurant_id, provider, config, is_active
                ) VALUES (?, ?, ?, ?)
                ON DUPLICATE KEY UPDATE
                config = VALUES(config),
                is_active = VALUES(is_active)`,
                [
                    restaurantId,
                    'PETPOOJA',
                    JSON.stringify(integration_config),
                    true
                ]
            );

            // Sync menu
            const result = await syncMenu(restaurantId);

            // Commit transaction
            await connection.commit();

            res.json({
                success: true,
                message: 'Restaurant and menu synchronized successfully',
                restaurant_id: restaurantId,
                ...result
            });
        } catch (error) {
            // Rollback transaction on error
            await connection.rollback();
            throw error;
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('Menu sync error:', error);
        res.status(error instanceof MenuSyncError ? 400 : 500).json({
            success: false,
            message: error.message,
            code: error.code,
            details: error.details
        });
    }
});

// Sync menu for a restaurant
router.post('/:restaurantId/sync', async (req, res) => {
    const { restaurantId } = req.params;

    try {
        const result = await syncMenu(restaurantId);
        res.json(result);
    } catch (error) {
        console.error('Menu sync error:', error);
        res.status(error instanceof MenuSyncError ? 400 : 500).json({
            success: false,
            message: error.message,
            code: error.code,
            details: error.details
        });
    }
});

module.exports = router; 