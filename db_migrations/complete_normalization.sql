-- Complete the POS configuration normalization

-- 1. Add missing columns to restaurant_pos_integrations
ALTER TABLE restaurant_pos_integrations 
ADD COLUMN pos_provider_id BIGINT UNSIGNED NULL AFTER pos_type,
ADD COLUMN restaurant_specific_config JSON NULL;

-- 2. Add foreign key constraint
ALTER TABLE restaurant_pos_integrations 
ADD FOREIGN KEY (pos_provider_id) REFERENCES pos_providers(id);

-- 3. Update existing records to link to PetPooja provider
UPDATE restaurant_pos_integrations 
SET pos_provider_id = 1 
WHERE pos_type = 'petpooja';

-- 4. Move existing config to restaurant_specific_config
UPDATE restaurant_pos_integrations 
SET restaurant_specific_config = config
WHERE config IS NOT NULL;

-- 5. Create webhook_secrets table for better secret management
CREATE TABLE IF NOT EXISTS restaurant_webhook_secrets (
    id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
    restaurant_id BIGINT UNSIGNED NOT NULL,
    pos_provider_id BIGINT UNSIGNED NOT NULL,
    secret_key VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP NULL,
    is_active BOOLEAN DEFAULT TRUE,
    PRIMARY KEY (id),
    FOREIGN KEY (restaurant_id) REFERENCES Restaurants(id) ON DELETE CASCADE,
    FOREIGN KEY (pos_provider_id) REFERENCES pos_providers(id) ON DELETE CASCADE,
    UNIQUE KEY uniq_restaurant_provider_active (restaurant_id, pos_provider_id, is_active),
    INDEX idx_webhook_secrets_active (is_active),
    INDEX idx_webhook_secrets_expires (expires_at)
);

-- 6. Migrate existing webhook secrets
INSERT INTO restaurant_webhook_secrets (restaurant_id, pos_provider_id, secret_key)
SELECT 
    rpi.restaurant_id,
    rpi.pos_provider_id,
    COALESCE(rpi.webhook_secret, CONCAT('secret_', rpi.pos_restaurant_id, '_', UNIX_TIMESTAMP()))
FROM restaurant_pos_integrations rpi
WHERE rpi.pos_provider_id IS NOT NULL
AND NOT EXISTS (
    SELECT 1 FROM restaurant_webhook_secrets rws 
    WHERE rws.restaurant_id = rpi.restaurant_id 
    AND rws.pos_provider_id = rpi.pos_provider_id
); 