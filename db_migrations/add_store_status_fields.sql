-- Migration: Add store status management fields to Restaurants table
-- Date: 2024-12-XX
-- Purpose: Support PetPooja store status update webhook functionality

-- Add columns for store status management
ALTER TABLE `Restaurants` 
ADD COLUMN IF NOT EXISTS `pos_turn_on_time` DATETIME DEFAULT NULL COMMENT 'Scheduled time to turn on the store' AFTER `payment_acceptance_type`,
ADD COLUMN IF NOT EXISTS `pos_status_reason` TEXT DEFAULT NULL COMMENT 'Reason for store status change' AFTER `pos_turn_on_time`;

-- Create audit table for store status history
CREATE TABLE IF NOT EXISTS `restaurant_status_history` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `restaurant_id` bigint(20) UNSIGNED NOT NULL,
    `old_status` tinyint(1) DEFAULT NULL,
    `new_status` tinyint(1) DEFAULT NULL,
    `turn_on_time` DATETIME DEFAULT NULL,
    `reason` TEXT DEFAULT NULL,
    `changed_by` varchar(100) DEFAULT NULL COMMENT 'Source of the change (webhook, admin, etc.)',
    `created_at` timestamp NULL DEFAULT current_timestamp(),
    PRIMARY KEY (`id`),
    KEY `idx_restaurant_status_history_restaurant` (`restaurant_id`),
    KEY `idx_restaurant_status_history_created` (`created_at`),
    CONSTRAINT `fk_restaurant_status_history_restaurant` 
        FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS `idx_restaurants_status_turnon` ON `Restaurants`(`is_active`, `pos_turn_on_time`); 