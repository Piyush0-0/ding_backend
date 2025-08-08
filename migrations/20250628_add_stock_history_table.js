const db = require('../db');

async function up() {
    const connection = await db.getConnection();
    
    try {
        console.log('Creating StockHistory table...');
        
        await connection.query(`
            CREATE TABLE StockHistory (
                id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
                item_type ENUM('item', 'addon') NOT NULL COMMENT 'Whether this is for an Item or AddOnItem',
                item_external_id VARCHAR(50) NOT NULL COMMENT 'External ID of the item/addon from POS',
                restaurant_id BIGINT UNSIGNED NOT NULL,
                old_stock_status TINYINT(1) COMMENT 'Previous stock status (0=out of stock, 1=in stock)',
                new_stock_status TINYINT(1) NOT NULL COMMENT 'New stock status (0=out of stock, 1=in stock)',
                auto_turn_on_time DATETIME COMMENT 'Scheduled time to automatically turn item back in stock',
                changed_by VARCHAR(100) NOT NULL DEFAULT 'system' COMMENT 'Source of change (petpooja_webhook, admin, system, etc.)',
                change_reason VARCHAR(255) COMMENT 'Reason for stock status change',
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY (id),
                FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE,
                INDEX idx_stock_history_restaurant (restaurant_id),
                INDEX idx_stock_history_item_type (item_type),
                INDEX idx_stock_history_external_id (item_external_id),
                INDEX idx_stock_history_created (created_at),
                INDEX idx_stock_history_auto_turn_on (auto_turn_on_time),
                INDEX idx_stock_history_restaurant_item (restaurant_id, item_external_id, item_type)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);
        
        console.log('✅ StockHistory table created successfully');
        
    } catch (error) {
        console.error('❌ Error creating StockHistory table:', error);
        throw error;
    } finally {
        connection.release();
    }
}

async function down() {
    const connection = await db.getConnection();
    
    try {
        console.log('Dropping StockHistory table...');
        await connection.query('DROP TABLE IF EXISTS StockHistory');
        console.log('✅ StockHistory table dropped successfully');
    } catch (error) {
        console.error('❌ Error dropping StockHistory table:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { up, down }; 