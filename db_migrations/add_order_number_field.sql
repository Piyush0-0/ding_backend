-- Add order_number field for formatted order identifiers
-- This allows you to have formatted order numbers like "A-1", "A-2", etc.
-- while keeping the integer primary key for database efficiency

ALTER TABLE Orders 
ADD COLUMN order_number VARCHAR(50) UNIQUE NULL AFTER id,
ADD INDEX idx_orders_order_number (order_number);

-- Optional: Generate order numbers for existing orders
-- UPDATE Orders SET order_number = CONCAT('A-', id) WHERE order_number IS NULL;

-- Optional: Create trigger to auto-generate order numbers for new orders
DELIMITER //
CREATE TRIGGER generate_order_number 
    BEFORE INSERT ON Orders 
    FOR each ROW 
BEGIN 
    IF NEW.order_number IS NULL THEN
        SET NEW.order_number = CONCAT('A-', (SELECT COALESCE(MAX(id), 0) + 1 FROM Orders o2));
    END IF;
END//
DELIMITER ;

-- Note: If you implement this, you'll need to update:
-- 1. Order creation logic to generate/store order_number
-- 2. PetPooja mappers to send order_number instead of id
-- 3. Callback handler to lookup by order_number
-- 4. All order-related APIs to use order_number for external references 