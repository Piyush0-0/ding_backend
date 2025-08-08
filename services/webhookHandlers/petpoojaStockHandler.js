const db = require('../../db');

/**
 * Handle PetPooja stock update webhook
 * Updates item or addon stock status based on external IDs
 */
async function handleStockUpdate({
    restaurant_id,
    type,
    in_stock,
    item_ids,
    fullPayload
}) {
    const connection = await db.getConnection();
    
    try {
        await connection.beginTransaction();
        
        // Validate input parameters
        if (!restaurant_id || !type || in_stock === undefined || !item_ids || !Array.isArray(item_ids)) {
            throw new Error(`Missing required stock update parameters: restaurant_id=${restaurant_id}, type=${type}, in_stock=${in_stock}, item_ids=${item_ids}`);
        }
        
        console.log(`📦 Processing stock update: ${type} - ${in_stock ? 'IN STOCK' : 'OUT OF STOCK'} for ${item_ids.length} items`);
        
        let updatedCount = 0;
        let notFoundItems = [];
        
        if (type === 'item') {
            // Update items stock status - NOTE: Items table uses 'is_active' field, not 'in_stock'
            for (const external_id of item_ids) {
                const [result] = await connection.query(
                    `UPDATE Items 
                     SET is_active = ?, updated_at = NOW() 
                     WHERE external_id = ? AND restaurant_id = ?`,
                    [in_stock ? 1 : 0, external_id, restaurant_id]
                );
                
                if (result.affectedRows > 0) {
                    updatedCount++;
                    console.log(`✅ Updated item stock: external_id=${external_id}, is_active=${in_stock}`);
                    
                    // Try to log the stock change (skip if table doesn't exist)
                    try {
                        await connection.query(
                            `INSERT INTO StockHistory 
                             (item_type, item_external_id, restaurant_id, old_stock_status, new_stock_status, 
                              changed_by, change_reason, created_at)
                             VALUES ('item', ?, ?, NULL, ?, 'petpooja_webhook', 'PetPooja stock update', NOW())`,
                            [external_id, restaurant_id, in_stock ? 1 : 0]
                        );
                    } catch (historyError) {
                        console.warn(`⚠️ Could not log stock history: ${historyError.message}`);
                    }
                } else {
                    notFoundItems.push(external_id);
                    console.warn(`⚠️ Item not found: external_id=${external_id}, restaurant_id=${restaurant_id}`);
                }
            }
        } else if (type === 'addon') {
            // Update addon items stock status
            for (const external_id of item_ids) {
                // First, get the addon and its restaurant through the addon group
                const [addonRows] = await connection.query(
                    `SELECT ai.id, ag.restaurant_id, ai.is_active 
                     FROM AddOnItems ai 
                     JOIN AddOnGroups ag ON ai.addon_group_id = ag.id 
                     WHERE ai.external_id = ? AND ag.restaurant_id = ?`,
                    [external_id, restaurant_id]
                );
                
                if (addonRows.length > 0) {
                    const addon = addonRows[0];
                    const oldStatus = addon.is_active;
                    
                    const [result] = await connection.query(
                        `UPDATE AddOnItems 
                         SET is_active = ?, updated_at = NOW() 
                         WHERE external_id = ? AND id = ?`,
                        [in_stock ? 1 : 0, external_id, addon.id]
                    );
                    
                    if (result.affectedRows > 0) {
                        updatedCount++;
                        console.log(`✅ Updated addon stock: external_id=${external_id}, is_active=${in_stock}`);
                        
                        // Try to log the stock change (skip if table doesn't exist)
                        try {
                            await connection.query(
                                `INSERT INTO StockHistory 
                                 (item_type, item_external_id, restaurant_id, old_stock_status, new_stock_status, 
                                  changed_by, change_reason, created_at)
                                 VALUES ('addon', ?, ?, ?, ?, 'petpooja_webhook', 'PetPooja addon stock update', NOW())`,
                                [external_id, restaurant_id, oldStatus, in_stock ? 1 : 0]
                            );
                        } catch (historyError) {
                            console.warn(`⚠️ Could not log addon stock history: ${historyError.message}`);
                        }
                    }
                } else {
                    notFoundItems.push(external_id);
                    console.warn(`⚠️ Addon not found: external_id=${external_id}, restaurant_id=${restaurant_id}`);
                }
            }
        }
        
        // Log the webhook processing
        try {
            await connection.query(
                `INSERT INTO WebhookLogs 
                 (webhook_type, payload, status, error_message, processed_at)
                 VALUES ('petpooja_stock_update', ?, ?, ?, NOW())`,
                [
                    JSON.stringify({
                        ...fullPayload,
                        processing_notes: {
                            updated_count: updatedCount,
                            not_found_items: notFoundItems,
                            type: type,
                            in_stock: in_stock
                        }
                    }),
                    notFoundItems.length === 0 ? 'success' : 'partial_success',
                    notFoundItems.length > 0 ? `Items not found: ${notFoundItems.join(', ')}` : null
                ]
            );
        } catch (logError) {
            console.warn(`⚠️ Could not log webhook: ${logError.message}`);
        }
        
        await connection.commit();
        
        console.log(`✅ Stock update completed: ${updatedCount} ${type}(s) updated, ${notFoundItems.length} not found`);
        
        const result = {
            success: true,
            message: `Stock update processed successfully`,
            details: {
                type: type,
                in_stock: in_stock,
                total_items: item_ids.length,
                updated_count: updatedCount,
                not_found_count: notFoundItems.length
            }
        };
        
        // Include not found items in response if any
        if (notFoundItems.length > 0) {
            result.warnings = [`Items not found: ${notFoundItems.join(', ')}`];
        }
        
        return result;
        
    } catch (error) {
        await connection.rollback();
        
        // Try to log the failed webhook
        try {
            await connection.query(
                `INSERT INTO WebhookLogs 
                 (webhook_type, payload, status, error_message, processed_at)
                 VALUES ('petpooja_stock_update', ?, 'failed', ?, NOW())`,
                [JSON.stringify(fullPayload), `${error.name}: ${error.message}`]
            );
        } catch (logError) {
            console.error('Failed to log stock update error:', logError);
        }
        
        console.error(`❌ Error processing PetPooja stock update:`, error);
        throw error;
    } finally {
        connection.release();
    }
}

/**
 * Get current stock status for items/addons by external IDs
 */
async function getStockStatus(restaurant_id, type, external_ids) {
    const connection = await db.getConnection();
    
    try {
        let results = [];
        
        if (type === 'item') {
            const [rows] = await connection.query(
                `SELECT external_id, is_active, name 
                 FROM Items 
                 WHERE external_id IN (${external_ids.map(() => '?').join(',')}) 
                 AND restaurant_id = ?`,
                [...external_ids, restaurant_id]
            );
            results = rows;
        } else if (type === 'addon') {
            const [rows] = await connection.query(
                `SELECT ai.external_id, ai.is_active, ai.name 
                 FROM AddOnItems ai 
                 JOIN AddOnGroups ag ON ai.addon_group_id = ag.id 
                 WHERE ai.external_id IN (${external_ids.map(() => '?').join(',')}) 
                 AND ag.restaurant_id = ?`,
                [...external_ids, restaurant_id]
            );
            results = rows;
        }
        
        return results;
        
    } finally {
        connection.release();
    }
}

module.exports = {
    handleStockUpdate,
    getStockStatus
}; 