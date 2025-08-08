-- ======================================================================
-- Add Order Breakdown Fields Migration
-- Adds detailed pricing breakdown fields to Orders table
-- ======================================================================

-- Add breakdown fields to Orders table
ALTER TABLE `Orders` 
ADD COLUMN IF NOT EXISTS `item_total` decimal(10,2) DEFAULT 0.00 COMMENT 'Total of all items before charges' AFTER `total_amount`,
ADD COLUMN IF NOT EXISTS `delivery_charge` decimal(10,2) DEFAULT 0.00 COMMENT 'Delivery charge applied' AFTER `item_total`,
ADD COLUMN IF NOT EXISTS `packaging_charge` decimal(10,2) DEFAULT 0.00 COMMENT 'Packaging charge applied' AFTER `delivery_charge`,
ADD COLUMN IF NOT EXISTS `service_charge` decimal(10,2) DEFAULT 0.00 COMMENT 'Service charge applied' AFTER `packaging_charge`,
ADD COLUMN IF NOT EXISTS `tax_amount` decimal(10,2) DEFAULT 0.00 COMMENT 'Total tax amount' AFTER `service_charge`,
ADD COLUMN IF NOT EXISTS `discount_amount` decimal(10,2) DEFAULT 0.00 COMMENT 'Total discount amount' AFTER `tax_amount`;

-- Create index for better performance on breakdown queries
CREATE INDEX IF NOT EXISTS `idx_orders_breakdown` ON `Orders`(`item_total`, `total_amount`);

-- ======================================================================
-- Migration completed - Added order breakdown fields:
-- - item_total: Sum of all items before any charges
-- - delivery_charge: Delivery charge applied to order
-- - packaging_charge: Packaging charge applied to order  
-- - service_charge: Service charge applied to order
-- - tax_amount: Total tax amount applied
-- - discount_amount: Total discount amount (for future use)
-- ====================================================================== 