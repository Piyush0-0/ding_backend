const db = require('../db');
const fs = require('fs');
const path = require('path');

// Load the blueprint for the restaurant from the sample JSON
const menuData = JSON.parse(fs.readFileSync(path.join(__dirname, 'petpooja-menu-sample.json'), 'utf-8'));
const externalRestaurant = menuData.restaurants[0];

async function seedRestaurant() {
    const connection = await db.getConnection();
    try {
        await connection.beginTransaction();
        console.log('--- Starting Restaurant Seeding Transaction ---');

        // --- 1. Create the Restaurant ---
        console.log(`Creating restaurant: "${externalRestaurant.res_name}"`);
        const [restaurantResult] = await connection.query(
            `INSERT INTO Restaurants (name, address, contact, latitude, longitude, created_by_user_id) 
             VALUES (?, ?, ?, ?, ?, ?)`,
            [
                externalRestaurant.res_name,
                externalRestaurant.address,
                externalRestaurant.contact_information,
                externalRestaurant.latitude,
                externalRestaurant.longitude,
                1 // Assuming a default user_id of 1
            ]
        );
        const newRestaurantId = restaurantResult.insertId;
        console.log(`Restaurant created with local ID: ${newRestaurantId}`);

        // --- 1a. Create the POS Integration Link ---
        console.log('Creating POS integration link...');
        const petpoojaConfig = {
            app_key: 'nh5xgk8jzr0mwv4qtau26yp3d17bs9ie',
            app_secret: '71b9cbaa4d866b7bb14668c6f76cd6a2c159aead',
            restID: externalRestaurant.restaurantid,
            menusharingcode: externalRestaurant.menusharingcode,
            save_order_endpoint: 'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1/save_order',
        };
        await connection.query(
            `INSERT INTO restaurant_pos_integrations (restaurant_id, pos_type, pos_restaurant_id, endpoint, api_key, config, active)
             VALUES (?, ?, ?, ?, ?, ?, ?)`,
            [
                newRestaurantId,
                'petpooja',
                externalRestaurant.restaurantid,
                'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1/mapped_restaurant_menus',
                '8c3ce1377b19c2f5da15b1cb4502bdc7344884c1',
                JSON.stringify(petpoojaConfig),
                1
            ]
        );
        console.log(`POS integration created for restaurant ID: ${newRestaurantId}`);

        // --- 2. Create Categories ---
        const categoryMap = new Map(); // Maps external cat ID -> local cat ID
        console.log('Creating categories...');
        for (const category of externalRestaurant.categories) {
            const [catResult] = await connection.query(
                `INSERT INTO Categories (restaurant_id, name, external_id) VALUES (?, ?, ?)`,
                [newRestaurantId, category.categoryname, category.categoryid]
            );
            categoryMap.set(category.categoryid, catResult.insertId);
        }
        console.log(`${externalRestaurant.categories.length} categories created.`);

        // --- 3. Create Addon Groups ---
        const addonGroupMap = new Map(); // Maps external group ID -> local group ID
        console.log('Creating addon groups...');
        for (const group of externalRestaurant.addongroups) {
            const [groupResult] = await connection.query(
                `INSERT INTO AddOnGroups (restaurant_id, name, external_id) VALUES (?, ?, ?)`,
                [newRestaurantId, group.addongroup_name, group.addongroupid]
            );
            addonGroupMap.set(group.addongroupid, groupResult.insertId);

            // --- 4. Create Addon Items for this group ---
            for (const addonItem of group.addongroupitems) {
                await connection.query(
                    `INSERT INTO AddOnItems (addon_group_id, name, price, external_id) VALUES (?, ?, ?, ?)`,
                    [groupResult.insertId, addonItem.addonitem_name, parseFloat(addonItem.addonitem_price), addonItem.addonitemid]
                );
            }
        }
        console.log(`${externalRestaurant.addongroups.length} addon groups and their items created.`);

        // --- 5. Create Items and their Variations/Addon Links ---
        console.log('Creating items and their associations...');
        for (const item of externalRestaurant.items) {
            const localCategoryId = categoryMap.get(item.item_categoryid);
            if (!localCategoryId) {
                console.warn(`Skipping item "${item.itemname}" because its category (${item.item_categoryid}) was not found.`);
                continue;
            }

            const [itemResult] = await connection.query(
                `INSERT INTO Items (restaurant_id, category_id, name, description, price, external_id) VALUES (?, ?, ?, ?, ?, ?)`,
                [newRestaurantId, localCategoryId, item.itemname, item.itemdescription, parseFloat(item.price), item.itemid]
            );
            const newItemId = itemResult.insertId;

            // --- 5a. Create Variations for this Item ---
            if (item.variation && item.variation.length > 0) {
                for (const variation of item.variation) {
                    await connection.query(
                        `INSERT INTO Variations (item_id, name, price, external_id) VALUES (?, ?, ?, ?)`,
                        [newItemId, variation.name, parseFloat(variation.price), variation.variationid]
                    );
                }
            }
            
            // --- 5b. Link Addon Groups to this Item ---
            const addonLinks = item.addon || [];
            if (item.variation) {
                addonLinks.push(...item.variation.flatMap(v => v.addon || []));
            }
            const uniqueAddonGroupIds = [...new Set(addonLinks.map(a => a.addon_group_id))];

            for (const groupId of uniqueAddonGroupIds) {
                const localGroupId = addonGroupMap.get(groupId);
                if (localGroupId) {
                    // This creates the link in the join table
                    await connection.query(
                        `INSERT INTO Item_Addon_Groups (item_id, addon_group_id) VALUES (?, ?)`,
                        [newItemId, localGroupId]
                    );
                }
            }
        }
        console.log(`${externalRestaurant.items.length} items created.`);

        await connection.commit();
        console.log('--- Transaction Committed Successfully! ---');
        console.log(`\nSeeding complete. A new restaurant '${externalRestaurant.res_name}' (ID: ${newRestaurantId}) has been created.`);

    } catch (error) {
        await connection.rollback();
        console.error('--- Transaction Rolled Back Due to Error ---');
        console.error('An error occurred during the seeding process:', error);
    } finally {
        if (connection) {
            connection.release();
            console.log('Database connection released.');
        }
        process.exit(0);
    }
}

seedRestaurant(); 