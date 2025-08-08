const db = require('../db');

async function up() {
    await db.query(`
        ALTER TABLE restaurant_pos_integrations 
        ADD COLUMN pos_restaurant_id VARCHAR(255) NULL COMMENT 'External restaurant ID from the POS system'
    `);
    await db.query(`
        ALTER TABLE restaurant_pos_integrations 
        ADD INDEX idx_pos_restaurant_id (pos_restaurant_id)
    `);
    console.log('Migration UP complete: Added pos_restaurant_id to restaurant_pos_integrations');
}

async function down() {
    // Note: Dropping a column is a destructive operation.
    // Make sure you have a backup if you need the data.
    await db.query(`
        ALTER TABLE restaurant_pos_integrations 
        DROP COLUMN pos_restaurant_id
    `);
    console.log('Migration DOWN complete: Removed pos_restaurant_id from restaurant_pos_integrations');
}

module.exports = { up, down }; 