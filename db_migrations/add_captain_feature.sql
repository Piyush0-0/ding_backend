-- Migration: Add captain feature to restaurants
-- Created: 2025-01-XX
-- Purpose: Enable captain assignment and management features for restaurants

-- Add captain feature columns one by one
ALTER TABLE restaurants ADD COLUMN captain_feature_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE restaurants ADD COLUMN captain_assignment_strategy ENUM('least_busy', 'area_based') DEFAULT 'least_busy';
ALTER TABLE restaurants ADD COLUMN captain_max_concurrent_tables INT DEFAULT 6;
ALTER TABLE restaurants ADD COLUMN captain_auto_escalate_minutes INT DEFAULT 15;
