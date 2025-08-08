-- Normalize POS configuration architecture
-- Separate provider-level config from restaurant-specific config

-- 1. Create POS Provider Configuration Table
CREATE TABLE pos_providers (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    provider_name VARCHAR(50) NOT NULL UNIQUE,      -- 'petpooja', 'posist', 'toast'
    display_name VARCHAR(100) NOT NULL,             -- 'PetPooja POS', 'POSist', 'Toast POS'
    base_api_url VARCHAR(500),                      -- Base API endpoint
    webhook_base_url VARCHAR(500),                  -- Your app's webhook base URL
    webhook_endpoints JSON,                         -- Specific webhook paths
    global_config JSON,                             -- Provider-level configuration
    auth_type ENUM('api_key', 'oauth', 'basic') DEFAULT 'api_key',
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (id),
    INDEX idx_pos_providers_name (provider_name),
    INDEX idx_pos_providers_active (is_active)
);

-- 2. Insert PetPooja provider configuration
INSERT INTO pos_providers (
    provider_name, 
    display_name, 
    base_api_url, 
    webhook_base_url,
    webhook_endpoints,
    global_config,
    auth_type
) VALUES (
    'petpooja',
    'PetPooja POS',
    'https://qle1yy2ydc.execute-api.ap-southeast-1.amazonaws.com/V1',
    'https://yourapp.com/api/webhooks/petpooja',
    JSON_OBJECT(
        'order_status', '/order-status',
        'menu_update', '/menu-update', 
        'inventory_update', '/inventory-update'
    ),
    JSON_OBJECT(
        'timeout', 15000,
        'retry_attempts', 3,
        'supported_order_types', JSON_ARRAY('DELIVERY', 'PICKUP', 'DINE_IN')
    ),
    'api_key'
);

-- 3. Modify restaurant_pos_integrations to reference provider (webhook_secret already exists)
ALTER TABLE restaurant_pos_integrations 
ADD COLUMN pos_provider_id BIGINT UNSIGNED NULL AFTER pos_type,
ADD COLUMN restaurant_specific_config JSON NULL;

-- Add foreign key constraint separately to avoid issues
ALTER TABLE restaurant_pos_integrations 
ADD FOREIGN KEY (pos_provider_id) REFERENCES pos_providers(id);

-- 4. Update existing records to use new structure
UPDATE restaurant_pos_integrations rpi
JOIN pos_providers pp ON pp.provider_name = rpi.pos_type
SET rpi.pos_provider_id = pp.id;

-- 5. Move restaurant-specific config from main config to separate field
UPDATE restaurant_pos_integrations 
SET restaurant_specific_config = config
WHERE config IS NOT NULL;

-- 6. Create webhook_secrets table for better secret management (recommended)
CREATE TABLE restaurant_webhook_secrets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    pos_provider_id BIGINT UNSIGNED NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,                      -- For secret rotation
    is_active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id),
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (pos_provider_id) REFERENCES pos_providers(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_restaurant_provider_active (restaurant_id, pos_provider_id, is_active),
    INDEX idx_webhook_secrets_active (is_active),
    INDEX idx_webhook_secrets_expires (expires_at)
);

-- 7. Migrate webhook secrets from restaurant_pos_integrations to new table
INSERT INTO restaurant_webhook_secrets (restaurant_id, pos_provider_id, secret_key)
SELECT 
    rpi.restaurant_id,
    rpi.pos_provider_id,
    COALESCE(rpi.webhook_secret, CONCAT('secret_', rpi.pos_restaurant_id, '_', UNIX_TIMESTAMP()))
FROM restaurant_pos_integrations rpi
WHERE rpi.pos_provider_id IS NOT NULL; 