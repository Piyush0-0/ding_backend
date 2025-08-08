-- ======================================================================
-- Add Order Type to Cart Table Migration
-- Adds order_type field to Cart table and migrates existing carts to DINE_IN
-- ======================================================================

-- Add order_type field to Cart table
ALTER TABLE `Cart` 
ADD COLUMN IF NOT EXISTS `order_type` ENUM('DINE_IN', 'PICKUP', 'DELIVERY') DEFAULT 'DINE_IN' COMMENT 'Order type for this cart' AFTER `order_group_id`;

-- Migrate all existing carts to DINE_IN (they will already have the default value)
UPDATE `Cart` SET `order_type` = 'DINE_IN' WHERE `order_type` IS NULL;

-- Create index for better performance on order type queries
CREATE INDEX IF NOT EXISTS `idx_cart_order_type` ON `Cart`(`order_type`, `is_finalized`);

-- ======================================================================
-- Migration completed - Added order_type field to Cart table:
-- - order_type: ENUM('DINE_IN', 'PICKUP', 'DELIVERY') with default 'DINE_IN'
-- - All existing carts migrated to DINE_IN
-- - Added index for performance
-- ====================================================================== 