-- Migration: Improve OrderGroup constraints and prevent race conditions
-- Date: 2024-12-15
-- Purpose: Add database-level constraints to prevent race conditions and improve data integrity

-- FIXED: MariaDB-compatible approach to prevent multiple ACTIVE groups per table
-- Since MariaDB doesn't support partial indexes, we'll use application-level enforcement
-- combined with a regular unique index on a computed column approach
-- For now, we'll rely on application logic and add performance indexes

-- Add index for better performance on group status queries
CREATE INDEX idx_ordergroups_status_restaurant ON OrderGroups (group_status, restaurant_id);

-- Add index specifically for active groups per table (helps with race condition queries)
CREATE INDEX idx_ordergroups_active_table ON OrderGroups (restaurant_id, table_id, group_status);

-- Add constraint to prevent invalid group status transitions at database level
-- (This works with our application-level validation)
ALTER TABLE OrderGroups 
ADD CONSTRAINT chk_valid_group_status 
CHECK (group_status IN ('active', 'pending_payment', 'closed', 'paid'));

-- Add constraint to prevent invalid payment status
ALTER TABLE OrderGroups 
ADD CONSTRAINT chk_valid_payment_status 
CHECK (payment_status IN ('pending', 'processing', 'paid', 'failed', 'refunded'));

-- Improve Cart table constraints for better conflict resolution
-- Add index for better cart conflict detection performance
CREATE INDEX idx_cart_user_restaurant_group ON Cart (user_id, restaurant_id, order_group_id, is_finalized);
CREATE INDEX idx_cart_session_restaurant_group ON Cart (session_id, restaurant_id, order_group_id, is_finalized);

-- FIXED: Allow NULL order_group_id for individual orders (pickup/delivery/non-table orders)
-- MariaDB foreign keys already handle NULL values correctly, so no additional constraint needed
-- The existing schema should already support this

-- Improve GroupParticipants constraints
-- Add index for better participant lookup performance
CREATE INDEX idx_groupparticipants_lookup ON GroupParticipants (order_group_id, user_id, session_id);

-- Add constraint to ensure at least one of user_id or session_id is not null
ALTER TABLE GroupParticipants 
ADD CONSTRAINT chk_participant_identity 
CHECK (user_id IS NOT NULL OR session_id IS NOT NULL);

-- Add trigger to automatically update OrderGroups.updated_at when related records change
DELIMITER ;;
CREATE TRIGGER update_ordergroup_timestamp_on_participant
AFTER INSERT ON GroupParticipants
FOR EACH ROW
BEGIN
    UPDATE OrderGroups 
    SET updated_at = NOW() 
    WHERE id = NEW.order_group_id;
END;;

CREATE TRIGGER update_ordergroup_timestamp_on_order
AFTER INSERT ON Orders
FOR EACH ROW
BEGIN
    IF NEW.order_group_id IS NOT NULL THEN
        UPDATE OrderGroups 
        SET updated_at = NOW() 
        WHERE id = NEW.order_group_id;
    END IF;
END;;
DELIMITER ;

-- Add view for easier group status monitoring
CREATE VIEW vw_ordergroup_summary AS
SELECT 
    og.id,
    og.restaurant_id,
    r.name as restaurant_name,
    og.table_id,
    rt.table_number,
    og.group_status,
    og.payment_status,
    og.total_amount,
    og.created_at,
    og.updated_at,
    COUNT(DISTINCT gp.id) as participant_count,
    COUNT(DISTINCT o.id) as order_count,
    COUNT(DISTINCT c.id) as pending_cart_count
FROM OrderGroups og
LEFT JOIN Restaurants r ON og.restaurant_id = r.id
LEFT JOIN RestaurantTables rt ON og.table_id = rt.id
LEFT JOIN GroupParticipants gp ON og.id = gp.order_group_id
LEFT JOIN Orders o ON og.id = o.order_group_id
LEFT JOIN Cart c ON og.id = c.order_group_id AND c.is_finalized = 0
GROUP BY og.id;

-- Add indexes for the view performance
CREATE INDEX idx_orders_group_id ON Orders (order_group_id);
CREATE INDEX idx_cart_group_finalized ON Cart (order_group_id, is_finalized);

-- Note: Race condition prevention for multiple active groups per table
-- is handled at the application level in the createOrJoinGroupForTable() function
-- using INSERT with ON DUPLICATE KEY UPDATE and proper transaction handling

COMMIT; 