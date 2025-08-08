-- Add webhook support columns to Orders table
ALTER TABLE Orders 
ADD COLUMN pos_order_id VARCHAR(255) NULL AFTER id,
ADD COLUMN pos_status_updated_at TIMESTAMP NULL,
ADD COLUMN estimated_delivery_time TIMESTAMP NULL,
ADD COLUMN completed_at TIMESTAMP NULL,
ADD COLUMN cancelled_at TIMESTAMP NULL,
ADD COLUMN cancellation_reason VARCHAR(255) NULL;

-- Create OrderStatusHistory table for tracking status changes
CREATE TABLE OrderStatusHistory (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    order_id BIGINT UNSIGNED NOT NULL,
    old_status VARCHAR(50) NOT NULL,
    new_status VARCHAR(50) NOT NULL,
    changed_by VARCHAR(100) NOT NULL,
    change_reason TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE,
    INDEX idx_order_status_history_order_id (order_id),
    INDEX idx_order_status_history_created_at (created_at)
);

-- Create NotificationQueue table for managing notifications
CREATE TABLE NotificationQueue (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    user_id BIGINT UNSIGNED,
    order_id BIGINT UNSIGNED,
    type VARCHAR(50) NOT NULL,
    phone_number VARCHAR(20),
    email VARCHAR(255),
    message TEXT,
    status ENUM('pending', 'sent', 'failed') DEFAULT 'pending',
    retry_count INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    FOREIGN KEY (user_id) REFERENCES Users(id) ON DELETE SET NULL,
    FOREIGN KEY (order_id) REFERENCES Orders(id) ON DELETE CASCADE,
    INDEX idx_notification_queue_status (status),
    INDEX idx_notification_queue_created_at (created_at)
);

-- Create WebhookLogs table for debugging and monitoring
CREATE TABLE WebhookLogs (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    webhook_type VARCHAR(50) NOT NULL,
    payload JSON NOT NULL,
    status ENUM('success', 'failed') NOT NULL,
    error_message TEXT,
    processed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_webhook_logs_type (webhook_type),
    INDEX idx_webhook_logs_status (status),
    INDEX idx_webhook_logs_processed_at (processed_at)
);

-- Add webhook configuration to restaurant_pos_integrations
ALTER TABLE restaurant_pos_integrations 
ADD COLUMN webhook_url VARCHAR(500) NULL AFTER config,
ADD COLUMN webhook_secret VARCHAR(255) NULL AFTER webhook_url;

-- Add menu sync tracking
CREATE TABLE MenuSyncHistory (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    sync_type VARCHAR(50) NOT NULL,
    status ENUM('success', 'failed', 'partial') NOT NULL,
    items_synced INT DEFAULT 0,
    error_message TEXT,
    started_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    completed_at TIMESTAMP NULL,
    PRIMARY KEY (id),
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE,
    INDEX idx_menu_sync_history_restaurant (restaurant_id),
    INDEX idx_menu_sync_history_started_at (started_at)
); 