-- Migration: Add StockHistory table for tracking stock changes
-- Created: [Current Date]

-- Create StockHistory table for tracking stock changes
CREATE TABLE IF NOT EXISTS StockHistory (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    item_type ENUM('item', 'addon') NOT NULL COMMENT 'Type of item being updated',
    item_external_id VARCHAR(50) NOT NULL COMMENT 'External ID of the item/addon',
    restaurant_id BIGINT UNSIGNED NOT NULL COMMENT 'Restaurant ID for context',
    old_stock_status TINYINT(1) DEFAULT NULL COMMENT 'Previous stock status (NULL for first record)',
    new_stock_status TINYINT(1) NOT NULL COMMENT 'New stock status',
    changed_by VARCHAR(100) NOT NULL COMMENT 'Who/what changed the status',
    change_reason TEXT COMMENT 'Reason for the change',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    INDEX idx_stock_history_item_type_external_id (item_type, item_external_id),
    INDEX idx_stock_history_restaurant_id (restaurant_id),
    INDEX idx_stock_history_created_at (created_at),
    INDEX idx_stock_history_changed_by (changed_by),
    
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci 
COMMENT='Tracks stock status changes for items and addons';

-- Add indexes for better performance on common queries
CREATE INDEX IF NOT EXISTS idx_stock_history_timeline ON StockHistory (restaurant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_history_item_timeline ON StockHistory (item_type, item_external_id, created_at); 