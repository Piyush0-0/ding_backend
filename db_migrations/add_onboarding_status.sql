-- Migration: Add onboarding status tracking to Restaurants table
-- This allows tracking of restaurant onboarding progress

ALTER TABLE Restaurants 
ADD COLUMN onboarding_status JSON DEFAULT NULL COMMENT 'JSON object tracking onboarding progress',
ADD COLUMN onboarding_completed_at TIMESTAMP NULL DEFAULT NULL COMMENT 'When onboarding was completed',
ADD COLUMN is_onboarding_complete BOOLEAN DEFAULT FALSE COMMENT 'Whether all onboarding steps are complete';

-- Example onboarding_status JSON structure:
-- {
--   "profile_complete": true,
--   "menu_setup": true, 
--   "bank_details": false,
--   "document_verification": false,
--   "pos_integration": false,
--   "test_order_placed": false
-- }

-- Create index for efficient querying
CREATE INDEX idx_restaurants_onboarding ON Restaurants(is_onboarding_complete, onboarding_completed_at); 