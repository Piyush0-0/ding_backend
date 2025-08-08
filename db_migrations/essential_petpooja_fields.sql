-- ======================================================================
-- Essential PetPooja Fields Migration - MINIMAL VERSION
-- Only adds fields we actually use for service charges and core functionality
-- ======================================================================

-- Add only essential fields for service charge calculation and POS integration
ALTER TABLE `Restaurants` 
-- Restaurant status (essential for operations)
ADD COLUMN IF NOT EXISTS `is_active` tinyint(1) DEFAULT 1 COMMENT 'Restaurant active status' AFTER `payment_acceptance_type`,

-- Service charge configuration (planned feature: "GST + editable Service charge")
ADD COLUMN IF NOT EXISTS `sc_applicable_on` varchar(10) DEFAULT 'H,P,D' COMMENT 'Service charge applicable on: D=DineIn, P=Parcel, H=Home Delivery' AFTER `is_active`,
ADD COLUMN IF NOT EXISTS `sc_type` enum('1','2') DEFAULT '2' COMMENT 'Service charge type: 1=Fixed, 2=Percentage' AFTER `sc_applicable_on`,
ADD COLUMN IF NOT EXISTS `sc_value` decimal(10,2) DEFAULT 0.00 COMMENT 'Service charge value' AFTER `sc_type`,

-- Enhanced packaging charge (PetPooja supports percentage)
ADD COLUMN IF NOT EXISTS `packaging_charge_type` enum('PERCENTAGE','FIXED') DEFAULT 'FIXED' COMMENT 'Packaging charge type' AFTER `packaging_charge`;

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS `idx_restaurants_active` ON `Restaurants`(`is_active`);

-- Update existing records with sensible defaults
UPDATE `Restaurants` SET 
    `is_active` = 1,
    `sc_applicable_on` = 'H,P,D',
    `sc_type` = '2',
    `sc_value` = 0.00,
    `packaging_charge_type` = 'FIXED'
WHERE `is_active` IS NULL;

-- ======================================================================
-- Migration completed - Added only essential fields:
-- - Restaurant status (is_active)
-- - Service charge configuration (sc_applicable_on, sc_type, sc_value)  
-- - Packaging charge type (PERCENTAGE vs FIXED support)
-- ====================================================================== 