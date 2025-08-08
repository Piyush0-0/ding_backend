-- Add new fields to Items table
ALTER TABLE `Items`
ADD COLUMN `item_attributeid` varchar(50) DEFAULT NULL COMMENT 'Veg/Non-veg attribute ID',
ADD COLUMN `item_tax` varchar(255) DEFAULT NULL COMMENT 'Comma-separated tax IDs',
ADD COLUMN `tax_inclusive` tinyint(1) DEFAULT 0 COMMENT 'Whether tax is included in price',
ADD COLUMN `gst_type` varchar(50) DEFAULT NULL COMMENT 'GST type (goods/services)',
ADD COLUMN `itemallowvariation` tinyint(1) DEFAULT 0 COMMENT 'Whether item allows variations',
ADD COLUMN `itemallowaddon` tinyint(1) DEFAULT 0 COMMENT 'Whether item allows add-ons',
ADD COLUMN `itemaddonbasedon` tinyint(1) DEFAULT 0 COMMENT 'Add-on selection basis',
ADD COLUMN `ignore_taxes` tinyint(1) DEFAULT 0 COMMENT 'Whether to ignore taxes',
ADD COLUMN `ignore_discounts` tinyint(1) DEFAULT 0 COMMENT 'Whether to ignore discounts',
ADD COLUMN `in_stock` tinyint(1) DEFAULT 1 COMMENT 'Item stock status';

-- Add new fields to Variations table
ALTER TABLE `Variations`
ADD COLUMN `variation_groupname` varchar(255) DEFAULT NULL COMMENT 'Variation group name',
ADD COLUMN `variationrank` int(11) DEFAULT 0 COMMENT 'Variation display rank',
ADD COLUMN `variationallowaddon` tinyint(1) DEFAULT 0 COMMENT 'Whether variation allows add-ons',
ADD COLUMN `addon_groups` JSON DEFAULT NULL COMMENT 'JSON array of add-on group mappings';

-- Add new fields to AddOnGroups table
ALTER TABLE `AddOnGroups`
ADD COLUMN `addongroup_rank` int(11) DEFAULT 0 COMMENT 'Add-on group display rank',
ADD COLUMN `min_selection` int(11) DEFAULT 0 COMMENT 'Minimum number of add-ons to select',
ADD COLUMN `max_selection` int(11) DEFAULT 1 COMMENT 'Maximum number of add-ons to select';

-- Create table for tax information
CREATE TABLE `Taxes` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `external_id` varchar(50) DEFAULT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `rate` decimal(5,2) NOT NULL,
  `type` varchar(50) DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `external_id` (`external_id`),
  KEY `restaurant_id` (`restaurant_id`),
  CONSTRAINT `taxes_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create table for item attributes
CREATE TABLE `ItemAttributes` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `external_id` varchar(50) DEFAULT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `external_id` (`external_id`),
  KEY `restaurant_id` (`restaurant_id`),
  CONSTRAINT `itemattributes_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci; 