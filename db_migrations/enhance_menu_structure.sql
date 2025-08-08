-- ======================================================================
-- Enhanced Menu Structure Migration for PetPooja Integration
-- This migration adds missing tables and fields to support full PetPooja menu sync
-- ======================================================================

-- 1. Create ItemAttributes table (completely missing)
CREATE TABLE IF NOT EXISTS `ItemAttributes` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `external_id` varchar(50) DEFAULT NULL,
    `restaurant_id` bigint(20) UNSIGNED NOT NULL,
    `name` varchar(100) NOT NULL COMMENT 'veg, non-veg, other, etc.',
    `is_active` tinyint(1) DEFAULT 1,
    `created_at` timestamp NULL DEFAULT current_timestamp(),
    `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `external_id` (`external_id`),
    KEY `restaurant_id` (`restaurant_id`),
    FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 2. Create Taxes table (completely missing)
CREATE TABLE IF NOT EXISTS `Taxes` (
    `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
    `external_id` varchar(50) DEFAULT NULL,
    `restaurant_id` bigint(20) UNSIGNED NOT NULL,
    `name` varchar(100) NOT NULL COMMENT 'SGST, CGST, VAT, etc.',
    `rate` decimal(5,2) NOT NULL COMMENT 'Tax rate: 2.5, 18.0, etc.',
    `type` enum('percentage', 'fixed') DEFAULT 'percentage',
    `tax_type` varchar(50) DEFAULT NULL COMMENT 'Additional tax type from PetPooja',
    `order_types` varchar(100) DEFAULT NULL COMMENT 'Comma-separated order types: 1,2,3',
    `rank` int DEFAULT 1 COMMENT 'Display order',
    `is_active` tinyint(1) DEFAULT 1,
    `created_at` timestamp NULL DEFAULT current_timestamp(),
    `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
    PRIMARY KEY (`id`),
    UNIQUE KEY `external_id` (`external_id`),
    KEY `restaurant_id` (`restaurant_id`),
    FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- 3. Add missing fields to Categories table
ALTER TABLE `Categories` 
ADD COLUMN IF NOT EXISTS `rank` int DEFAULT 1 COMMENT 'Display order' AFTER `is_active`;

-- 4. Add extensive missing fields to Items table
ALTER TABLE `Items` 
ADD COLUMN IF NOT EXISTS `rank` int DEFAULT 1 COMMENT 'Display order' AFTER `prep_time`,
ADD COLUMN IF NOT EXISTS `attribute_id` varchar(50) DEFAULT NULL COMMENT 'External attribute ID from PetPooja' AFTER `rank`,
ADD COLUMN IF NOT EXISTS `tax_ids` varchar(255) DEFAULT NULL COMMENT 'Comma-separated tax IDs' AFTER `attribute_id`,
ADD COLUMN IF NOT EXISTS `tax_inclusive` tinyint(1) DEFAULT 0 COMMENT 'Whether price includes tax' AFTER `tax_ids`,
ADD COLUMN IF NOT EXISTS `gst_type` varchar(50) DEFAULT NULL COMMENT 'GST classification' AFTER `tax_inclusive`,
ADD COLUMN IF NOT EXISTS `allow_variation` tinyint(1) DEFAULT 0 COMMENT 'Item allows variations' AFTER `gst_type`,
ADD COLUMN IF NOT EXISTS `allow_addon` tinyint(1) DEFAULT 0 COMMENT 'Item allows add-ons' AFTER `allow_variation`,
ADD COLUMN IF NOT EXISTS `addon_based_on` varchar(50) DEFAULT NULL COMMENT 'Add-on selection basis' AFTER `allow_addon`,
ADD COLUMN IF NOT EXISTS `ignore_taxes` tinyint(1) DEFAULT 0 COMMENT 'Ignore taxes for this item' AFTER `addon_based_on`,
ADD COLUMN IF NOT EXISTS `ignore_discounts` tinyint(1) DEFAULT 0 COMMENT 'Ignore discounts for this item' AFTER `ignore_taxes`,
ADD COLUMN IF NOT EXISTS `in_stock` tinyint(1) DEFAULT 1 COMMENT 'Item availability' AFTER `ignore_discounts`,
ADD COLUMN IF NOT EXISTS `order_types` varchar(100) DEFAULT NULL COMMENT 'Allowed order types: 1,2,3' AFTER `in_stock`,
ADD COLUMN IF NOT EXISTS `packing_charges` decimal(10,2) DEFAULT 0.00 COMMENT 'Item-specific packing charges' AFTER `order_types`,
ADD COLUMN IF NOT EXISTS `item_info` JSON DEFAULT NULL COMMENT 'Additional item information' AFTER `packing_charges`,
ADD COLUMN IF NOT EXISTS `tags` JSON DEFAULT NULL COMMENT 'Item tags array' AFTER `item_info`;

-- 5. Add missing fields to Variations table
ALTER TABLE `Variations`
ADD COLUMN IF NOT EXISTS `variation_groupname` varchar(255) DEFAULT NULL COMMENT 'Variation group name' AFTER `price`,
ADD COLUMN IF NOT EXISTS `rank` int DEFAULT 1 COMMENT 'Display order within group' AFTER `variation_groupname`,
ADD COLUMN IF NOT EXISTS `allow_addon` tinyint(1) DEFAULT 0 COMMENT 'Variation allows add-ons' AFTER `rank`,
ADD COLUMN IF NOT EXISTS `addon_groups` JSON DEFAULT NULL COMMENT 'Associated addon groups' AFTER `allow_addon`,
ADD COLUMN IF NOT EXISTS `markup_price` decimal(10,2) DEFAULT NULL COMMENT 'Markup over base price' AFTER `addon_groups`,
ADD COLUMN IF NOT EXISTS `packing_charges` decimal(10,2) DEFAULT 0.00 COMMENT 'Variation-specific packing charges' AFTER `markup_price`;

-- 6. Add missing fields to AddOnGroups table
ALTER TABLE `AddOnGroups`
ADD COLUMN IF NOT EXISTS `rank` int DEFAULT 1 COMMENT 'Display order' AFTER `max_selection`,
ADD COLUMN IF NOT EXISTS `is_active` tinyint(1) DEFAULT 1 COMMENT 'Group availability' AFTER `rank`;

-- 7. Add missing fields to AddOnItems table  
ALTER TABLE `AddOnItems`
ADD COLUMN IF NOT EXISTS `attribute_id` varchar(50) DEFAULT NULL COMMENT 'External attribute ID' AFTER `price`,
ADD COLUMN IF NOT EXISTS `rank` int DEFAULT 1 COMMENT 'Display order within group' AFTER `attribute_id`;

-- 8. Create indexes for better performance
CREATE INDEX IF NOT EXISTS `idx_items_attribute` ON `Items`(`attribute_id`);
CREATE INDEX IF NOT EXISTS `idx_items_rank` ON `Items`(`rank`);
CREATE INDEX IF NOT EXISTS `idx_items_stock` ON `Items`(`in_stock`);
CREATE INDEX IF NOT EXISTS `idx_categories_rank` ON `Categories`(`rank`);
CREATE INDEX IF NOT EXISTS `idx_variations_rank` ON `Variations`(`rank`);
CREATE INDEX IF NOT EXISTS `idx_variations_group` ON `Variations`(`variation_groupname`);
CREATE INDEX IF NOT EXISTS `idx_addongroups_rank` ON `AddOnGroups`(`rank`);
CREATE INDEX IF NOT EXISTS `idx_addonitems_rank` ON `AddOnItems`(`rank`);
CREATE INDEX IF NOT EXISTS `idx_taxes_active` ON `Taxes`(`is_active`);
CREATE INDEX IF NOT EXISTS `idx_attributes_active` ON `ItemAttributes`(`is_active`);

-- 9. Insert default attributes (common across restaurants)
INSERT IGNORE INTO `ItemAttributes` (`external_id`, `restaurant_id`, `name`, `is_active`) VALUES
('1', 1, 'veg', 1),
('2', 1, 'non-veg', 1),
('5', 1, 'other', 1);

-- Add indexes for external_id lookups (for better sync performance)
CREATE INDEX IF NOT EXISTS `idx_categories_external` ON `Categories`(`external_id`);
CREATE INDEX IF NOT EXISTS `idx_items_external` ON `Items`(`external_id`);
CREATE INDEX IF NOT EXISTS `idx_variations_external` ON `Variations`(`external_id`);
CREATE INDEX IF NOT EXISTS `idx_addongroups_external` ON `AddOnGroups`(`external_id`);
CREATE INDEX IF NOT EXISTS `idx_addonitems_external` ON `AddOnItems`(`external_id`);

-- 10. Add composite indexes for better query performance
CREATE INDEX IF NOT EXISTS `idx_items_restaurant_category` ON `Items`(`restaurant_id`, `category_id`);
CREATE INDEX IF NOT EXISTS `idx_items_restaurant_active` ON `Items`(`restaurant_id`, `is_active`);
CREATE INDEX IF NOT EXISTS `idx_variations_item_active` ON `Variations`(`item_id`, `is_active`);
CREATE INDEX IF NOT EXISTS `idx_addongroups_restaurant_active` ON `AddOnGroups`(`restaurant_id`, `is_active`);

-- ======================================================================
-- Migration completed successfully
-- This adds full support for PetPooja menu structure including:
-- - ItemAttributes table for veg/non-veg classification
-- - Taxes table for tax management
-- - Enhanced Items table with all PetPooja fields
-- - Enhanced Variations table with grouping and addon support
-- - Enhanced AddOnGroups and AddOnItems with ranking
-- - Performance indexes for better sync speed
-- ====================================================================== 