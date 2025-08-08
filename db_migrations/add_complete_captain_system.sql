-- Migration: Add complete captain system
-- Created: 2025-01-XX
-- Purpose: Implement full captain assignment and management system

-- 1. Create captains table
CREATE TABLE captains (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED NOT NULL,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    assigned_area_id BIGINT UNSIGNED NULL,
    captain_level ENUM('trainee', 'junior', 'senior') DEFAULT 'junior',
    max_concurrent_tables INT DEFAULT 6,
    status ENUM('active', 'inactive') DEFAULT 'active',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (assigned_area_id) REFERENCES area(id) ON DELETE SET NULL,
    UNIQUE KEY unique_user_restaurant (user_id, restaurant_id)
);

-- 2. Add captain columns to OrderGroups table (one by one)
ALTER TABLE ordergroups ADD COLUMN assigned_captain_id BIGINT UNSIGNED NULL COMMENT 'Captain assigned to this table';
ALTER TABLE ordergroups ADD COLUMN captain_assignment_method ENUM('auto', 'manual', 'fallback') DEFAULT 'auto';
ALTER TABLE ordergroups ADD COLUMN captain_assigned_at TIMESTAMP NULL COMMENT 'When captain was assigned';
ALTER TABLE ordergroups ADD COLUMN captain_status ENUM('assigned', 'acknowledged', 'serving', 'completed') DEFAULT 'assigned';
ALTER TABLE ordergroups ADD COLUMN captain_acknowledged_at TIMESTAMP NULL COMMENT 'When captain acknowledged table';
ALTER TABLE ordergroups ADD COLUMN captain_notes TEXT NULL COMMENT 'Captain notes about this table';

-- Add foreign key and indexes for OrderGroups
ALTER TABLE ordergroups ADD FOREIGN KEY (assigned_captain_id) REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE ordergroups ADD INDEX idx_ordergroups_captain (assigned_captain_id, captain_status);
ALTER TABLE ordergroups ADD INDEX idx_ordergroups_captain_restaurant (restaurant_id, assigned_captain_id);

-- 3. Create captain_calls table
CREATE TABLE captain_calls (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_group_id BIGINT UNSIGNED NULL,
    table_id BIGINT UNSIGNED NULL,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    
    call_type ENUM('assistance', 'complaint', 'billing') DEFAULT 'assistance',
    message TEXT NULL,
    status ENUM('pending', 'acknowledged', 'resolved') DEFAULT 'pending',
    
    called_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at TIMESTAMP NULL,
    resolved_at TIMESTAMP NULL,
    
    PRIMARY KEY (id),
    FOREIGN KEY (order_group_id) REFERENCES ordergroups(id) ON DELETE SET NULL,
    FOREIGN KEY (table_id) REFERENCES `table`(id) ON DELETE SET NULL,
    FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE,
    
    INDEX idx_captain_calls_order_group (order_group_id, status),
    INDEX idx_captain_calls_restaurant (restaurant_id, called_at)
);

-- 4. Add captain columns to Users table (one by one)
ALTER TABLE users ADD COLUMN role ENUM('admin', 'manager', 'captain', 'customer') DEFAULT 'customer';
ALTER TABLE users ADD COLUMN captain_id INT NULL;
ALTER TABLE users ADD FOREIGN KEY (captain_id) REFERENCES captains(id);
