const db = require('../db');
const { fetchMenu } = require('./posAdapters/petpoojaAdapter');
const { getPetpoojaAdapterConfig } = require('./posConfigService');

class MenuSyncError extends Error {
    constructor(message, code, details) {
        super(message);
        this.name = 'MenuSyncError';
        this.code = code;
        this.details = details;
    }
}

async function syncMenu(restaurantId) {
    try {
        // ✅ NEW: Get POS integration using normalized structure
        const { integration, config } = await getPetpoojaAdapterConfig(restaurantId);
        
        if (!integration || !integration.active) {
            throw new MenuSyncError('No active POS integration found', 'NO_INTEGRATION');
        }

        // Fetch menu from PetPooja using merged config
        const menuData = await fetchMenu(config);
        if (!menuData.data || menuData.data.success !== '1') {
            throw new MenuSyncError('Invalid menu data received', 'INVALID_MENU_DATA');
        }

        return await processMenuData(restaurantId, menuData.data);
    } catch (error) {
        console.error('Menu sync error:', error);
        throw new MenuSyncError(
            error.message || 'Failed to sync menu',
            error.code || 'SYNC_ERROR',
            error.details
        );
    }
}

/**
 * Process push menu data from webhook payload (PUSH operation)
 */
async function processPushMenuData(restaurantId, pushMenuPayload) {
    try {
        console.log('🔄 Processing push menu data for restaurant', restaurantId);
        
        if (!pushMenuPayload.success || pushMenuPayload.success !== '1') {
            throw new MenuSyncError('Invalid push menu data received', 'INVALID_PUSH_DATA');
        }

        return await processMenuData(restaurantId, pushMenuPayload);
    } catch (error) {
        console.error('Push menu processing error:', error);
        throw new MenuSyncError(
            error.message || 'Failed to process push menu data',
            error.code || 'PUSH_PROCESSING_ERROR',
            error.details
        );
    }
}

/**
 * Common function to process menu data (from either PULL or PUSH operations)
 */
async function processMenuData(restaurantId, menuData) {
    // Start transaction
    const connection = await db.getConnection();
    await connection.beginTransaction();

    try {
        // Sync in correct order to maintain referential integrity
        console.log('🔄 Starting menu processing for restaurant', restaurantId);
        
        // 1. Sync attributes first (needed for items and addons)
        await syncAttributes(connection, restaurantId, menuData.attributes || []);
        console.log('✅ Attributes synced');

        // 2. Sync taxes (needed for items)
        await syncTaxes(connection, restaurantId, menuData.taxes || []);
        console.log('✅ Taxes synced');

        // 3. Sync categories (needed for items)
        await syncCategories(connection, restaurantId, menuData.categories || []);
        console.log('✅ Categories synced');

        // 4. Sync add-on groups and items (needed for item-addon associations)
        await syncAddonGroups(connection, restaurantId, menuData.addongroups || []);
        console.log('✅ Add-on groups synced');

        // 5. Sync items and variations (main menu items)
        await syncItems(connection, restaurantId, menuData.items || []);
        console.log('✅ Items synced');

        // 6. Sync standalone variations (from variations array)
        await syncStandaloneVariations(connection, restaurantId, menuData.variations || []);
        console.log('✅ Standalone variations synced');

        // Commit transaction
        await connection.commit();
        await validateMenuForeignKeys(connection, restaurantId);
        console.log('🎉 Menu processing completed successfully');
        
        return { 
            success: true, 
            message: 'Menu processed successfully',
            stats: {
                categories: menuData.categories?.length || 0,
                items: menuData.items?.length || 0,
                variations: menuData.variations?.length || 0,
                addonGroups: menuData.addongroups?.length || 0,
                attributes: menuData.attributes?.length || 0,
                taxes: menuData.taxes?.length || 0
            }
        };
    } catch (error) {
        // Rollback transaction on error
        await connection.rollback();
        console.error('❌ Menu processing failed, transaction rolled back:', error);
        throw error;
    } finally {
        connection.release();
    }
}

async function syncCategories(connection, restaurantId, categories) {
    console.log(`📂 Syncing ${categories.length} categories...`);
    
    for (const category of categories) {
        await connection.query(
            `INSERT INTO Categories (external_id, restaurant_id, name, is_active, \`rank\`)
             VALUES (?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             is_active = VALUES(is_active),
             \`rank\` = VALUES(\`rank\`)`,
            [
                category.categoryid, 
                restaurantId, 
                category.categoryname, 
                category.active === '1',
                parseInt(category.categoryrank) || 1
            ]
        );
    }
}

async function syncAttributes(connection, restaurantId, attributes) {
    console.log(`🏷️ Syncing ${attributes.length} attributes...`);
    
    for (const attribute of attributes) {
        await connection.query(
            `INSERT INTO ItemAttributes (external_id, restaurant_id, name, is_active)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             is_active = VALUES(is_active)`,
            [attribute.attributeid, restaurantId, attribute.attribute, attribute.active === '1']
        );
    }
}

async function syncTaxes(connection, restaurantId, taxes) {
    console.log(`💰 Syncing ${taxes.length} taxes...`);
    
    for (const tax of taxes) {
        await connection.query(
            `INSERT INTO Taxes (external_id, restaurant_id, name, rate, type, tax_type, order_types, \`rank\`, tax_coreortotal, description, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             rate = VALUES(rate),
             type = VALUES(type),
             tax_type = VALUES(tax_type),
             order_types = VALUES(order_types),
             \`rank\` = VALUES(\`rank\`),
             tax_coreortotal = VALUES(tax_coreortotal),
             description = VALUES(description),
             is_active = VALUES(is_active)`,
            [
                tax.taxid, 
                restaurantId, 
                tax.taxname, 
                parseFloat(tax.tax), 
                tax.taxtype === '1' ? 'percentage' : 'fixed',
                tax.tax_taxtype,
                tax.tax_ordertype,
                parseInt(tax.rank) || 1,
                tax.tax_coreortotal || null,
                tax.description || null,
                tax.active === '1'
            ]
        );
    }
}

async function syncAddonGroups(connection, restaurantId, addonGroups) {
    console.log(`🔗 Syncing ${addonGroups.length} add-on groups...`);
    
    for (const group of addonGroups) {
        // Insert add-on group with enhanced fields
        const [result] = await connection.query(
            `INSERT INTO AddOnGroups (external_id, restaurant_id, name, min_selection, max_selection, \`rank\`, is_active)
             VALUES (?, ?, ?, ?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             min_selection = VALUES(min_selection),
             max_selection = VALUES(max_selection),
             \`rank\` = VALUES(\`rank\`),
             is_active = VALUES(is_active)`,
            [
                group.addongroupid,
                restaurantId,
                group.addongroup_name,
                0, // Default min selection - PetPooja doesn't provide this
                99, // Default max selection - will be overridden by item-specific rules
                parseInt(group.addongroup_rank) || 1,
                group.active === '1'
            ]
        );

        const groupId = result.insertId || (await getAddonGroupId(connection, group.addongroupid, restaurantId));

        // Sync add-on items with enhanced fields
        if (group.addongroupitems && Array.isArray(group.addongroupitems)) {
            for (const item of group.addongroupitems) {
                await connection.query(
                    `INSERT INTO AddOnItems (external_id, addon_group_id, name, price, attribute_id, \`rank\`, is_active)
                     VALUES (?, ?, ?, ?, ?, ?, ?)
                     ON DUPLICATE KEY UPDATE
                     name = VALUES(name),
                     price = VALUES(price),
                     attribute_id = VALUES(attribute_id),
                     \`rank\` = VALUES(\`rank\`),
                     is_active = VALUES(is_active)`,
                    [
                        item.addonitemid, 
                        groupId, 
                        item.addonitem_name, 
                        parseFloat(item.addonitem_price) || 0,
                        item.attributes,
                        parseInt(item.addonitem_rank) || 1,
                        item.active === '1'
                    ]
                );
            }
        }
    }
}

async function syncItems(connection, restaurantId, items) {
    console.log(`🍽️ Syncing ${items.length} items...`);
    
    for (const item of items) {
        // Calculate base price (minimum variation price or item price)
        let price = parseFloat(item.price) || 0;
        if (item.variation && item.variation.length > 0) {
            const variationPrices = item.variation
                .map(v => parseFloat(v.price))
                .filter(p => !isNaN(p) && p > 0);
            if (variationPrices.length > 0) {
                price = Math.min(...variationPrices);
            }
        }

        // Get category ID from external_id
        const categoryId = await getCategoryId(connection, item.item_categoryid, restaurantId);
        if (!categoryId) {
            console.warn(`⚠️ Category not found for item ${item.itemname}, external_id: ${item.item_categoryid}`);
            continue;
        }

        // Insert item with all enhanced fields
        const [result] = await connection.query(
            `INSERT INTO Items (
                external_id, restaurant_id, category_id, name, description, price, image_url,
                is_recommend, prep_time, \`rank\`, attribute_id, tax_ids, tax_inclusive, gst_type,
                allow_variation, allow_addon, addon_based_on, ignore_taxes, ignore_discounts,
                in_stock, order_types, packing_charges, item_info, tags, is_active
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE
            name = VALUES(name),
            description = VALUES(description),
            price = VALUES(price),
            image_url = VALUES(image_url),
            is_recommend = VALUES(is_recommend),
            prep_time = VALUES(prep_time),
            \`rank\` = VALUES(\`rank\`),
            attribute_id = VALUES(attribute_id),
            tax_ids = VALUES(tax_ids),
            tax_inclusive = VALUES(tax_inclusive),
            gst_type = VALUES(gst_type),
            allow_variation = VALUES(allow_variation),
            allow_addon = VALUES(allow_addon),
            addon_based_on = VALUES(addon_based_on),
            ignore_taxes = VALUES(ignore_taxes),
            ignore_discounts = VALUES(ignore_discounts),
            in_stock = VALUES(in_stock),
            order_types = VALUES(order_types),
            packing_charges = VALUES(packing_charges),
            item_info = VALUES(item_info),
            tags = VALUES(tags),
            is_active = VALUES(is_active)`,
            [
                item.itemid,
                restaurantId,
                categoryId,
                item.itemname,
                item.itemdescription || null,
                price,
                item.item_image_url || null,
                item.is_recommend === '1' ? 1 : 0,
                parseInt(item.minimumpreparationtime) || 15,
                parseInt(item.itemrank) || 1,
                item.item_attributeid,
                item.item_tax, // Comma-separated tax IDs
                item.tax_inclusive ? 1 : 0,
                item.gst_type,
                item.itemallowvariation === '1' ? 1 : 0,
                item.itemallowaddon === '1' ? 1 : 0,
                item.itemaddonbasedon,
                item.ignore_taxes === '1' ? 1 : 0,
                item.ignore_discounts === '1' ? 1 : 0,
                item.in_stock === '2' ? 1 : 0, // PetPooja: '2' = in stock, '1' = out of stock
                item.item_ordertype,
                parseFloat(item.item_packingcharges) || 0,
                item.item_info ? JSON.stringify(item.item_info) : null,
                item.item_tags && item.item_tags.length > 0 ? JSON.stringify(item.item_tags) : null,
                item.active === '1' ? 1 : 0
            ]
        );

        const itemId = result.insertId || (await getItemId(connection, item.itemid, restaurantId));

        // Sync variations for this item
        if (item.variation && Array.isArray(item.variation)) {
            for (const variation of item.variation) {
                await connection.query(
                    `INSERT INTO Variations (
                        external_id, item_id, name, price, variation_groupname, \`rank\`,
                        allow_addon, addon_groups, markup_price, packing_charges, is_active
                    )
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                    ON DUPLICATE KEY UPDATE
                    name = VALUES(name),
                    price = VALUES(price),
                    variation_groupname = VALUES(variation_groupname),
                    \`rank\` = VALUES(\`rank\`),
                    allow_addon = VALUES(allow_addon),
                    addon_groups = VALUES(addon_groups),
                    markup_price = VALUES(markup_price),
                    packing_charges = VALUES(packing_charges),
                    is_active = VALUES(is_active)`,
                    [
                        variation.id,
                        itemId,
                        variation.name,
                        parseFloat(variation.price) || 0,
                        variation.groupname,
                        parseInt(variation.variationrank) || 1,
                        variation.variationallowaddon ? 1 : 0,
                        variation.addon && variation.addon.length > 0 ? JSON.stringify(variation.addon) : null,
                        parseFloat(variation.markup_price) || null,
                        parseFloat(variation.item_packingcharges) || 0,
                        variation.active === '1' ? 1 : 0
                    ]
                );
            }
        }

        // Sync add-on group mappings for this item
        if (item.addon && Array.isArray(item.addon)) {
            // First, clear existing mappings for this item
            await connection.query(
                'DELETE FROM Item_Addon_Groups WHERE item_id = ?',
                [itemId]
            );

            // Then insert new mappings
            for (const addon of item.addon) {
                await connection.query(
                    `INSERT INTO Item_Addon_Groups (item_id, addon_group_id)
                     SELECT ?, id FROM AddOnGroups WHERE external_id = ? AND restaurant_id = ?`,
                    [itemId, addon.addon_group_id, restaurantId]
                );
            }
        }
    }
}

async function syncStandaloneVariations(connection, restaurantId, variations) {
    console.log(`🔀 Syncing ${variations.length} standalone variations...`);
    
    // These are variations that might not be attached to items yet
    // Useful for maintaining variation master data
    for (const variation of variations) {
        // Try to find the item this variation belongs to
        // This is mainly for data consistency
        await connection.query(
            `INSERT IGNORE INTO Variations (external_id, name, variation_groupname, is_active)
             VALUES (?, ?, ?, ?)
             ON DUPLICATE KEY UPDATE
             name = VALUES(name),
             variation_groupname = VALUES(variation_groupname),
             is_active = VALUES(is_active)`,
            [
                variation.variationid,
                variation.name,
                variation.groupname,
                variation.status === '1' ? 1 : 0
            ]
        );
    }
}

// Helper functions
async function getAddonGroupId(connection, externalId, restaurantId) {
    const [rows] = await connection.query(
        'SELECT id FROM AddOnGroups WHERE external_id = ? AND restaurant_id = ?',
        [externalId, restaurantId]
    );
    return rows[0]?.id;
}

async function getItemId(connection, externalId, restaurantId) {
    const [rows] = await connection.query(
        'SELECT id FROM Items WHERE external_id = ? AND restaurant_id = ?',
        [externalId, restaurantId]
    );
    return rows[0]?.id;
}

async function getCategoryId(connection, externalId, restaurantId) {
    const [rows] = await connection.query(
        'SELECT id FROM Categories WHERE external_id = ? AND restaurant_id = ?',
        [externalId, restaurantId]
    );
    return rows[0]?.id;
}

async function validateMenuForeignKeys(connection, restaurantId) {
    // Check Items.category_id
    const [invalidItems] = await connection.query(
        `SELECT i.id, i.name FROM Items i LEFT JOIN Categories c ON i.category_id = c.id WHERE i.restaurant_id = ? AND c.id IS NULL`,
        [restaurantId]
    );
    if (invalidItems.length > 0) {
        console.error('❌ Invalid Items with missing Categories:', invalidItems);
        throw new MenuSyncError('Invalid Items with missing Categories', 'INVALID_ITEM_CATEGORY', invalidItems);
    }
    // Check Variations.item_id
    const [invalidVariations] = await connection.query(
        `SELECT v.id, v.name FROM Variations v LEFT JOIN Items i ON v.item_id = i.id WHERE i.id IS NULL`
    );
    if (invalidVariations.length > 0) {
        console.error('❌ Invalid Variations with missing Items:', invalidVariations);
        throw new MenuSyncError('Invalid Variations with missing Items', 'INVALID_VARIATION_ITEM', invalidVariations);
    }
    // Check AddOnItems.addon_group_id
    const [invalidAddons] = await connection.query(
        `SELECT a.id, a.name FROM AddOnItems a LEFT JOIN AddOnGroups g ON a.addon_group_id = g.id WHERE g.id IS NULL`
    );
    if (invalidAddons.length > 0) {
        console.error('❌ Invalid AddOnItems with missing AddOnGroups:', invalidAddons);
        throw new MenuSyncError('Invalid AddOnItems with missing AddOnGroups', 'INVALID_ADDON_GROUP', invalidAddons);
    }
    // Check Items.tax_ids
    const [items] = await connection.query(
        `SELECT id, name, tax_ids FROM Items WHERE restaurant_id = ? AND tax_ids IS NOT NULL AND tax_ids != ''`,
        [restaurantId]
    );
    for (const item of items) {
        const taxIds = item.tax_ids.split(',').map(t => t.trim()).filter(Boolean);
        for (const taxId of taxIds) {
            const [taxRows] = await connection.query(
                'SELECT id FROM Taxes WHERE external_id = ? AND restaurant_id = ?',
                [taxId, restaurantId]
            );
            if (taxRows.length === 0) {
                console.error(`❌ Item ${item.name} (${item.id}) references missing Tax external_id: ${taxId}`);
                throw new MenuSyncError(`Item ${item.name} references missing Tax`, 'INVALID_ITEM_TAX', { item, taxId });
            }
        }
    }
    // Check Items.attribute_id
    const [itemsWithAttr] = await connection.query(
        `SELECT id, name, attribute_id FROM Items WHERE restaurant_id = ? AND attribute_id IS NOT NULL AND attribute_id != ''`,
        [restaurantId]
    );
    for (const item of itemsWithAttr) {
        const [attrRows] = await connection.query(
            'SELECT id FROM ItemAttributes WHERE external_id = ? AND restaurant_id = ?',
            [item.attribute_id, restaurantId]
        );
        if (attrRows.length === 0) {
            console.error(`❌ Item ${item.name} (${item.id}) references missing Attribute external_id: ${item.attribute_id}`);
            throw new MenuSyncError(`Item ${item.name} references missing Attribute`, 'INVALID_ITEM_ATTRIBUTE', { item });
        }
    }
    console.log('✅ All foreign keys validated successfully.');
}

module.exports = {
    syncMenu,
    processPushMenuData,
    MenuSyncError
}; 