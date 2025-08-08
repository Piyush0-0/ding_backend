-- Create EventCategories table to maintain a list of valid event categories
CREATE TABLE `EventCategories` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create SubCategories table
CREATE TABLE `SubCategories` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `category_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `is_custom` tinyint(1) DEFAULT 0,
  `created_by_restaurant_id` bigint(20) UNSIGNED DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  UNIQUE KEY `category_name` (`category_id`, `name`),
  KEY `is_custom` (`is_custom`),
  KEY `created_by_restaurant_id` (`created_by_restaurant_id`),
  CONSTRAINT `subcategories_ibfk_1` FOREIGN KEY (`category_id`) REFERENCES `EventCategories` (`id`) ON DELETE CASCADE,
  CONSTRAINT `subcategories_ibfk_2` FOREIGN KEY (`created_by_restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Insert default event categories
INSERT INTO `EventCategories` (`name`, `description`) VALUES
('Live Music', 'Events featuring live musical performances'),
('Food Festival', 'Events showcasing various cuisines and food items'),
('Cooking Class', 'Events where participants learn cooking techniques'),
('Wine Tasting', 'Events focused on wine appreciation and tasting'),
('Cultural Event', 'Events celebrating cultural traditions and practices'),
('Corporate Event', 'Events organized for business purposes'),
('Private Party', 'Events for private celebrations'),
('Workshop', 'Educational or skill-building events');

-- Insert default subcategories for each category
INSERT INTO `SubCategories` (`category_id`, `name`, `description`) VALUES
-- Live Music subcategories
(1, 'Jazz Night', 'Evening of jazz music performances'),
(1, 'Rock Concert', 'Live rock music performance'),
(1, 'Classical Music', 'Classical music performances'),
(1, 'Acoustic Session', 'Intimate acoustic music sessions'),

-- Food Festival subcategories
(2, 'Street Food Festival', 'Celebration of street food from various cuisines'),
(2, 'Fine Dining Experience', 'High-end culinary showcase'),
(2, 'Food Truck Gathering', 'Collection of food trucks offering diverse cuisines'),
(2, 'Regional Cuisine Festival', 'Showcase of specific regional cuisines'),

-- Cooking Class subcategories
(3, 'Basic Cooking Skills', 'Introduction to fundamental cooking techniques'),
(3, 'Advanced Techniques', 'Advanced culinary skills and methods'),
(3, 'Baking Workshop', 'Specialized baking and pastry making'),
(3, 'International Cuisine', 'Cooking classes focused on specific international cuisines'),

-- Wine Tasting subcategories
(4, 'Wine Pairing', 'Wine and food pairing sessions'),
(4, 'Wine Education', 'Educational sessions about wine'),
(4, 'Vintage Tasting', 'Tasting of aged and vintage wines'),
(4, 'Regional Wines', 'Focus on wines from specific regions'),

-- Cultural Event subcategories
(5, 'Traditional Dance', 'Performances of traditional dance forms'),
(5, 'Cultural Festival', 'Celebration of cultural traditions'),
(5, 'Art Exhibition', 'Display of cultural art forms'),
(5, 'Heritage Tour', 'Guided tours of cultural heritage'),

-- Corporate Event subcategories
(6, 'Team Building', 'Activities focused on team development'),
(6, 'Product Launch', 'Launch of new products or services'),
(6, 'Corporate Dinner', 'Formal dining events for corporate groups'),
(6, 'Conference', 'Business conferences and meetings'),

-- Private Party subcategories
(7, 'Birthday Celebration', 'Birthday party events'),
(7, 'Anniversary Party', 'Anniversary celebration events'),
(7, 'Graduation Party', 'Graduation celebration events'),
(7, 'Family Gathering', 'Family reunion and gathering events'),

-- Workshop subcategories
(8, 'Culinary Skills', 'Workshops focused on cooking skills'),
(8, 'Mixology', 'Cocktail making and bartending workshops'),
(8, 'Food Photography', 'Photography workshops for food'),
(8, 'Menu Planning', 'Workshops on restaurant menu development');

-- Create Events table
CREATE TABLE `Events` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `image_url` text DEFAULT NULL,
  `event_time` datetime NOT NULL,
  `category_id` bigint(20) UNSIGNED NOT NULL,
  `subcategory_id` bigint(20) UNSIGNED NOT NULL,
  `metadata` json DEFAULT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `restaurant_id` (`restaurant_id`),
  KEY `event_time` (`event_time`),
  KEY `is_active` (`is_active`),
  KEY `category_id` (`category_id`),
  KEY `subcategory_id` (`subcategory_id`),
  CONSTRAINT `events_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE,
  CONSTRAINT `events_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `EventCategories` (`id`) ON DELETE RESTRICT,
  CONSTRAINT `events_ibfk_3` FOREIGN KEY (`subcategory_id`) REFERENCES `SubCategories` (`id`) ON DELETE RESTRICT
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- Create EventBookings table to track event bookings
CREATE TABLE `EventBookings` (
  `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `event_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `booking_status` enum('pending','confirmed','cancelled') DEFAULT 'pending',
  `number_of_guests` int(11) NOT NULL DEFAULT 1,
  `special_requests` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  PRIMARY KEY (`id`),
  KEY `event_id` (`event_id`),
  KEY `user_id` (`user_id`),
  KEY `booking_status` (`booking_status`),
  CONSTRAINT `eventbookings_ibfk_1` FOREIGN KEY (`event_id`) REFERENCES `Events` (`id`) ON DELETE CASCADE,
  CONSTRAINT `eventbookings_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci; 