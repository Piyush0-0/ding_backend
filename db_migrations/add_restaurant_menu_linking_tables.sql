-- Migration: Add Restaurant-Menu Linking Tables for Shared External IDs
-- Purpose: Handle scenarios where multiple restaurants share the same POS menu (same menu_sharing_code)
-- Date: 2025-06-30

-- 1. Restaurant-Category Linking (Many-to-Many)
CREATE TABLE IF NOT EXISTS restaurant_categories (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    category_id BIGINT UNSIGNED NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    rank INT DEFAULT 1,
    restaurant_specific_name VARCHAR(255) NULL, -- Allow restaurant to override category name
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_restaurant_category (restaurant_id, category_id),
    INDEX idx_restaurant_id (restaurant_id),
    INDEX idx_category_id (category_id),
    INDEX idx_active (is_active),
    
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (category_id) REFERENCES Categories(id) ON DELETE CASCADE
);

-- 2. Restaurant-Item Linking (Many-to-Many)
CREATE TABLE IF NOT EXISTS restaurant_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    item_id BIGINT UNSIGNED NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    rank INT DEFAULT 1,
    
    -- Restaurant-specific overrides
    restaurant_specific_price DECIMAL(10,2) NULL, -- Override item price
    restaurant_specific_name VARCHAR(255) NULL,   -- Override item name
    restaurant_specific_description TEXT NULL,     -- Override item description
    restaurant_specific_availability TINYINT(1) NULL, -- Override availability
    restaurant_specific_prep_time INT NULL,       -- Override prep time
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_restaurant_item (restaurant_id, item_id),
    INDEX idx_restaurant_id (restaurant_id),
    INDEX idx_item_id (item_id),
    INDEX idx_active (is_active),
    INDEX idx_price (restaurant_specific_price),
    
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (item_id) REFERENCES Items(id) ON DELETE CASCADE
);

-- 3. Restaurant-AddOnGroup Linking (Many-to-Many)
CREATE TABLE IF NOT EXISTS restaurant_addon_groups (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    addon_group_id BIGINT UNSIGNED NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    rank INT DEFAULT 1,
    restaurant_specific_name VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_restaurant_addon_group (restaurant_id, addon_group_id),
    INDEX idx_restaurant_id (restaurant_id),
    INDEX idx_addon_group_id (addon_group_id),
    INDEX idx_active (is_active),
    
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (addon_group_id) REFERENCES AddOnGroups(id) ON DELETE CASCADE
);

-- 4. Restaurant-AddOnItem Linking (Many-to-Many) 
CREATE TABLE IF NOT EXISTS restaurant_addon_items (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    addon_item_id BIGINT UNSIGNED NOT NULL,
    is_active TINYINT(1) DEFAULT 1,
    rank INT DEFAULT 1,
    restaurant_specific_price DECIMAL(10,2) NULL, -- Override addon price
    restaurant_specific_name VARCHAR(255) NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    UNIQUE KEY unique_restaurant_addon_item (restaurant_id, addon_item_id),
    INDEX idx_restaurant_id (restaurant_id),
    INDEX idx_addon_item_id (addon_item_id),
    INDEX idx_active (is_active),
    
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (addon_item_id) REFERENCES AddOnItems(id) ON DELETE CASCADE
);

-- 5. Add indexes to existing tables for better external_id lookups
ALTER TABLE Categories ADD INDEX IF NOT EXISTS idx_external_id (external_id);
ALTER TABLE Items ADD INDEX IF NOT EXISTS idx_external_id (external_id);
ALTER TABLE AddOnGroups ADD INDEX IF NOT EXISTS idx_external_id (external_id);
ALTER TABLE AddOnItems ADD INDEX IF NOT EXISTS idx_external_id (external_id);

-- 6. Add composite indexes for restaurant-specific queries
ALTER TABLE Categories ADD INDEX IF NOT EXISTS idx_restaurant_external (restaurant_id, external_id);
ALTER TABLE Items ADD INDEX IF NOT EXISTS idx_restaurant_external (restaurant_id, external_id);
ALTER TABLE AddOnGroups ADD INDEX IF NOT EXISTS idx_restaurant_external (restaurant_id, external_id);

-- 7. Create a view for easy menu querying
CREATE OR REPLACE VIEW restaurant_menu_view AS
SELECT 
    r.id as restaurant_id,
    r.name as restaurant_name,
    c.id as category_id,
    c.external_id as category_external_id,
    COALESCE(rc.restaurant_specific_name, c.name) as category_name,
    rc.is_active as category_active,
    rc.rank as category_rank,
    i.id as item_id,
    i.external_id as item_external_id,
    COALESCE(ri.restaurant_specific_name, i.name) as item_name,
    COALESCE(ri.restaurant_specific_description, i.description) as item_description,
    COALESCE(ri.restaurant_specific_price, i.price) as item_price,
    COALESCE(ri.restaurant_specific_availability, i.is_active) as item_available,
    ri.is_active as item_restaurant_active,
    ri.rank as item_rank
FROM Restaurants r
LEFT JOIN restaurant_categories rc ON r.id = rc.restaurant_id AND rc.is_active = 1
LEFT JOIN Categories c ON rc.category_id = c.id AND c.is_active = 1
LEFT JOIN restaurant_items ri ON r.id = ri.restaurant_id AND ri.is_active = 1
LEFT JOIN Items i ON ri.item_id = i.id AND i.category_id = c.id
WHERE r.id IS NOT NULL
ORDER BY r.id, rc.rank, ri.rank;

-- 8. Data sync tracking table
CREATE TABLE IF NOT EXISTS menu_sync_log (
    id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    sync_type ENUM('full', 'incremental', 'manual') DEFAULT 'manual',
    sync_status ENUM('started', 'completed', 'failed') DEFAULT 'started',
    external_records_processed INT DEFAULT 0,
    new_records_created INT DEFAULT 0,
    existing_records_reused INT DEFAULT 0,
    conflicts_resolved INT DEFAULT 0,
    error_message TEXT NULL,
    sync_duration_ms INT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    
    INDEX idx_restaurant_id (restaurant_id),
    INDEX idx_sync_status (sync_status),
    INDEX idx_created_at (created_at),
    
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE
); 