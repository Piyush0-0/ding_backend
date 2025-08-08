-- phpMyAdmin SQL Dump
-- version 5.2.2
-- https://www.phpmyadmin.net/
--
-- Host: localhost:3306
-- Generation Time: May 13, 2025 at 01:32 PM
-- Server version: 10.6.21-MariaDB-cll-lve-log
-- PHP Version: 8.3.19

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `mydiveez_dingrmsnew`
--

-- --------------------------------------------------------

--
-- Table structure for table `AddOnGroups`
--

CREATE TABLE `AddOnGroups` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `external_id` varchar(50) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `min_selection` int(11) DEFAULT 0,
  `max_selection` int(11) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  `restaurant_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `AddOnGroups`
--

INSERT INTO `AddOnGroups` (`id`, `external_id`, `name`, `min_selection`, `max_selection`, `created_at`, `updated_at`, `restaurant_id`) VALUES
(1, '135699', 'Add Beverage', 0, 1, '2025-03-14 21:31:24', '2025-03-14 21:31:24', 1),
(2, '135707', 'Extra Toppings', 0, 4, '2025-03-14 21:31:24', '2025-03-14 21:31:24', 1),
(3, NULL, 'Spice Level', 1, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48', 2),
(4, NULL, 'Extra Toppings', 0, 3, '2025-04-26 11:31:48', '2025-04-26 11:31:48', 2),
(5, NULL, 'Sides', 0, 2, '2025-04-26 11:31:48', '2025-04-26 11:31:48', 2),
(6, NULL, 'Protein Add-ons', 0, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48', 3),
(7, NULL, 'Dressings', 0, 2, '2025-04-26 11:31:48', '2025-04-26 11:31:48', 3),
(8, NULL, 'Cheese Options', 0, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48', 4),
(9, NULL, 'Extra Fillings', 0, 4, '2025-04-26 11:31:48', '2025-04-26 11:31:48', 4);

-- --------------------------------------------------------

--
-- Table structure for table `AddOnItems`
--

CREATE TABLE `AddOnItems` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `external_id` varchar(50) DEFAULT NULL,
  `addon_group_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `AddOnItems`
--

INSERT INTO `AddOnItems` (`id`, `external_id`, `addon_group_id`, `name`, `price`, `is_active`, `created_at`, `updated_at`) VALUES
(1, '1150783', 1, 'Mojito', 0.00, 1, '2025-03-14 21:35:59', '2025-03-14 21:35:59'),
(2, '1150784', 1, 'Hazelnut Mocha', 10.00, 1, '2025-03-14 21:35:59', '2025-03-14 21:35:59'),
(3, '1150810', 2, 'Egg', 20.00, 1, '2025-03-14 21:35:59', '2025-03-14 21:35:59'),
(4, '1150811', 2, 'Jalapenos', 20.00, 1, '2025-03-14 21:35:59', '2025-03-14 21:35:59'),
(5, '1150812', 2, 'Onion Rings', 20.00, 1, '2025-03-14 21:35:59', '2025-03-14 21:35:59'),
(6, '1150813', 2, 'Cheese', 10.00, 1, '2025-03-14 21:35:59', '2025-03-14 21:35:59'),
(7, NULL, 3, 'Mild', 0.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(8, NULL, 3, 'Medium', 0.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(9, NULL, 3, 'Hot', 0.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(10, NULL, 4, 'Extra Cheese', 50.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(11, NULL, 4, 'Mushrooms', 40.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(12, NULL, 4, 'Paneer Cubes', 60.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(13, NULL, 5, 'Papad', 30.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(14, NULL, 5, 'Mint Chutney', 20.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(15, NULL, 5, 'Onion Salad', 25.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(16, NULL, 6, 'Grilled Chicken', 80.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(17, NULL, 6, 'Paneer', 60.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(18, NULL, 6, 'Tofu', 50.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(19, NULL, 7, 'Honey Mustard', 30.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(20, NULL, 7, 'Balsamic', 30.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(21, NULL, 7, 'Ranch', 30.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(22, NULL, 8, 'Cheddar', 40.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(23, NULL, 8, 'Mozzarella', 40.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(24, NULL, 8, 'Blue Cheese', 50.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(25, NULL, 9, 'Bacon', 60.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(26, NULL, 9, 'Fried Egg', 40.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(27, NULL, 9, 'Avocado', 50.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(28, NULL, 9, 'Caramelized Onions', 30.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48');

-- --------------------------------------------------------

--
-- Table structure for table `Cart`
--

CREATE TABLE `Cart` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `order_group_id` bigint(20) UNSIGNED DEFAULT NULL,
  `is_finalized` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `CartItemAddOns`
--

CREATE TABLE `CartItemAddOns` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `cart_item_id` bigint(20) UNSIGNED NOT NULL,
  `addon_id` bigint(20) UNSIGNED NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `CartItems`
--

CREATE TABLE `CartItems` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `cart_id` bigint(20) UNSIGNED NOT NULL,
  `item_id` bigint(20) UNSIGNED NOT NULL,
  `variation_id` bigint(20) UNSIGNED DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `add_ons_total` decimal(10,2) DEFAULT 0.00,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `price` decimal(10,2) GENERATED ALWAYS AS (`unit_price` * `quantity`) STORED,
  `addon_items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`addon_items`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Categories`
--

CREATE TABLE `Categories` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `external_id` varchar(50) DEFAULT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `Categories`
--

INSERT INTO `Categories` (`id`, `external_id`, `restaurant_id`, `name`, `is_active`, `created_at`, `updated_at`) VALUES
(1, '500773', 1, 'Pizza and Sides', 1, '2025-03-14 21:08:35', '2025-03-14 21:08:35'),
(2, '500774', 1, 'Cakes', 1, '2025-03-14 21:08:35', '2025-03-14 21:08:35'),
(3, NULL, 2, 'Appetizers', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(4, NULL, 2, 'Main Course', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(5, NULL, 2, 'Desserts', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(6, NULL, 2, 'Beverages', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(7, NULL, 3, 'Breakfast', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(8, NULL, 3, 'Lunch Specials', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(9, NULL, 3, 'Dinner Combos', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(10, NULL, 3, 'Signature Dishes', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(11, NULL, 4, 'Burgers', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(12, NULL, 4, 'Pasta', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(13, NULL, 4, 'Sandwiches', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(14, NULL, 4, 'Salads', 1, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(15, '500775', 1, 'Beverages', 1, '2025-05-01 13:15:15', '2025-05-01 13:15:15'),
(16, '500776', 1, 'Starters', 1, '2025-05-01 13:15:15', '2025-05-01 13:15:15'),
(17, '500777', 1, 'Main Course', 1, '2025-05-01 13:15:15', '2025-05-01 13:15:15');

-- --------------------------------------------------------

--
-- Table structure for table `GroupParticipants`
--

CREATE TABLE `GroupParticipants` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_group_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `session_id` varchar(255) DEFAULT NULL,
  `joined_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Items`
--

CREATE TABLE `Items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `external_id` varchar(50) DEFAULT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `category_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `price` decimal(10,2) NOT NULL,
  `image_url` text DEFAULT NULL,
  `is_recommend` tinyint(1) DEFAULT 0,
  `is_active` tinyint(1) DEFAULT 1,
  `prep_time` int(11) DEFAULT 15,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `Items`
--

INSERT INTO `Items` (`id`, `external_id`, `restaurant_id`, `category_id`, `name`, `description`, `price`, `image_url`, `is_recommend`, `is_active`, `prep_time`, `created_at`, `updated_at`) VALUES
(1, NULL, 1, 1, 'Veg Loaded Pizza', 'Delicious pizza with various veggies', 250.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pasta.jpeg?alt=media&token=2ba84fd8-10e7-414b-9731-f12612690d4c', 0, 1, 15, '2025-03-14 21:10:41', '2025-03-14 21:10:41'),
(2, NULL, 1, 1, 'Paneer Tikka', 'Grilled paneer cubes marinated in spices', 200.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pasta.jpeg?alt=media&token=2ba84fd8-10e7-414b-9731-f12612690d4c', 0, 1, 15, '2025-03-14 21:10:41', '2025-03-14 21:10:41'),
(3, NULL, 1, 2, 'Chocolate Cake', 'Rich chocolate cake', 310.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pasta.jpeg?alt=media&token=2ba84fd8-10e7-414b-9731-f12612690d4c', 0, 1, 15, '2025-03-14 21:10:41', '2025-03-14 21:10:41'),
(4, NULL, 2, 2, 'Paneer Tikka', 'Marinated cottage cheese grilled to perfection', 220.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/chicken.jpeg?alt=media&token=87207436-a8ce-420f-bbbb-57c2a4a90ef0', 1, 1, 15, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(5, NULL, 2, 2, 'Veg Spring Rolls', 'Crispy rolls filled with fresh vegetables', 180.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pasta.jpeg?alt=media&token=2ba84fd8-10e7-414b-9731-f12612690d4c', 0, 1, 15, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(6, NULL, 2, 3, 'Butter Chicken', 'Tender chicken in rich tomato and butter sauce', 320.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/chicken.jpeg?alt=media&token=87207436-a8ce-420f-bbbb-57c2a4a90ef0', 1, 1, 15, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(7, NULL, 2, 3, 'Dal Makhani', 'Black lentils cooked with butter and cream', 240.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pasta.jpeg?alt=media&token=2ba84fd8-10e7-414b-9731-f12612690d4c', 0, 1, 15, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(8, NULL, 2, 4, 'Gulab Jamun', 'Sweet dumplings soaked in sugar syrup', 120.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/manchuria.jpeg?alt=media&token=bdb0d672-6eda-4def-9b0a-a5c5ad4812c7', 1, 1, 15, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(9, NULL, 2, 5, 'Mango Lassi', 'Refreshing yogurt drink with mango pulp', 90.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/chicken.jpeg?alt=media&token=87207436-a8ce-420f-bbbb-57c2a4a90ef0', 0, 1, 15, '2025-04-26 11:31:47', '2025-04-26 11:31:47'),
(10, NULL, 3, 6, 'Avocado Toast', 'Whole grain toast with smashed avocado', 180.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/manchuria.jpeg?alt=media&token=bdb0d672-6eda-4def-9b0a-a5c5ad4812c7', 1, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(11, NULL, 3, 6, 'Masala Omelette', 'Fluffy eggs with fresh herbs and spices', 150.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/chicken.jpeg?alt=media&token=87207436-a8ce-420f-bbbb-57c2a4a90ef0', 0, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(12, NULL, 3, 7, 'Buddha Bowl', 'Nutritious mix of grains, veggies, and protein', 250.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/chicken.jpeg?alt=media&token=87207436-a8ce-420f-bbbb-57c2a4a90ef0', 1, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(13, NULL, 3, 8, 'Mushroom Risotto', 'Creamy Arborio rice with exotic mushrooms', 320.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/manchuria.jpeg?alt=media&token=bdb0d672-6eda-4def-9b0a-a5c5ad4812c7', 0, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(14, NULL, 3, 9, 'Cloud Special Biryani', 'Fragrant basmati rice with chef\'s special spices', 380.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pasta.jpeg?alt=media&token=2ba84fd8-10e7-414b-9731-f12612690d4c', 1, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(15, NULL, 4, 10, 'Classic Cheese Burger', 'Juicy patty with cheddar on a brioche bun', 280.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pizza.jpeg?alt=media&token=c4159681-3d3a-4d8f-9258-9bb7b0cbe5e9', 1, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(16, NULL, 4, 10, 'Veggie Burger', 'Plant-based patty with fresh toppings', 240.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/manchuria.jpeg?alt=media&token=bdb0d672-6eda-4def-9b0a-a5c5ad4812c7', 0, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(17, NULL, 4, 11, 'Penne Arrabiata', 'Penne in spicy tomato sauce with garlic', 260.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pizza.jpeg?alt=media&token=c4159681-3d3a-4d8f-9258-9bb7b0cbe5e9', 1, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(18, NULL, 4, 12, 'Club Sandwich', 'Triple-decker with chicken, bacon, and veggies', 220.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/nachos.jpeg?alt=media&token=0edbba4a-c8f8-4539-8063-469fbbd20a8c', 0, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(19, NULL, 4, 13, 'Caesar Salad', 'Crisp romaine with parmesan and croutons', 190.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/nachos.jpeg?alt=media&token=0edbba4a-c8f8-4539-8063-469fbbd20a8c', 1, 1, 15, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(20, NULL, 1, 15, 'Coke', 'Chilled Coca-Cola', 50.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pizza.jpeg?alt=media&token=c4159681-3d3a-4d8f-9258-9bb7b0cbe5e9', 0, 1, 5, '2025-05-01 13:15:15', '2025-05-01 13:15:15'),
(21, NULL, 1, 15, 'Orange Juice', 'Freshly squeezed orange juice', 80.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/chicken.jpeg?alt=media&token=87207436-a8ce-420f-bbbb-57c2a4a90ef0', 0, 1, 5, '2025-05-01 13:15:15', '2025-05-01 13:15:15'),
(22, NULL, 1, 16, 'Spring Rolls', 'Crispy vegetable spring rolls', 120.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/nachos.jpeg?alt=media&token=0edbba4a-c8f8-4539-8063-469fbbd20a8c', 0, 1, 10, '2025-05-01 13:15:15', '2025-05-01 13:15:15'),
(23, NULL, 1, 17, 'Paneer Butter Masala', 'Creamy paneer curry', 220.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/nachos.jpeg?alt=media&token=0edbba4a-c8f8-4539-8063-469fbbd20a8c', 0, 1, 20, '2025-05-01 13:15:15', '2025-05-01 13:15:15'),
(24, NULL, 1, 17, 'Dal Tadka', 'Yellow dal with tadka', 150.00, 'https://firebasestorage.googleapis.com/v0/b/ding-app-fe465.firebasestorage.app/o/pizza.jpeg?alt=media&token=c4159681-3d3a-4d8f-9258-9bb7b0cbe5e9', 0, 1, 15, '2025-05-01 13:15:15', '2025-05-01 13:15:15');

-- --------------------------------------------------------

--
-- Table structure for table `Item_Addon_Groups`
--

CREATE TABLE `Item_Addon_Groups` (
  `item_id` bigint(20) UNSIGNED NOT NULL,
  `addon_group_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `Item_Addon_Groups`
--

INSERT INTO `Item_Addon_Groups` (`item_id`, `addon_group_id`) VALUES
(1, 1),
(1, 2),
(4, 3),
(4, 4),
(6, 3),
(6, 5),
(10, 6),
(12, 7),
(13, 6),
(15, 8),
(15, 9),
(16, 8),
(16, 9),
(18, 9);

-- --------------------------------------------------------

--
-- Table structure for table `OrderGroups`
--

CREATE TABLE `OrderGroups` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `table_id` bigint(20) UNSIGNED DEFAULT NULL,
  `location_type` enum('TABLE','DELIVERY','PICKUP') NOT NULL,
  `location_details` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`location_details`)),
  `qr_code` varchar(255) DEFAULT NULL,
  `payment_status` enum('pending','processing','paid','failed','refunded') DEFAULT 'pending',
  `group_status` enum('active','pending_payment','closed') DEFAULT 'active',
  `total_amount` decimal(10,2) DEFAULT 0.00,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_reference` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `session_id` varchar(100) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `OrderItemAddOns`
--

CREATE TABLE `OrderItemAddOns` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_item_id` bigint(20) UNSIGNED NOT NULL,
  `addon_id` bigint(20) UNSIGNED NOT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `price` decimal(10,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `OrderItems`
--

CREATE TABLE `OrderItems` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` bigint(20) UNSIGNED NOT NULL,
  `item_id` bigint(20) UNSIGNED NOT NULL,
  `variation_id` bigint(20) UNSIGNED DEFAULT NULL,
  `quantity` int(11) NOT NULL DEFAULT 1,
  `unit_price` decimal(10,2) NOT NULL,
  `add_ons_total` decimal(10,2) DEFAULT 0.00,
  `status` enum('ADDED','SENT_TO_KITCHEN','SERVED','CANCELLED') DEFAULT 'ADDED',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `addon_items` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`addon_items`))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Orders`
--

CREATE TABLE `Orders` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `order_group_id` bigint(20) UNSIGNED DEFAULT NULL,
  `order_status` enum('pending','pending_payment','confirmed','preparing','ready','delivered','cancelled') DEFAULT 'pending',
  `payment_status` enum('pending','processing','paid','failed','refunded') DEFAULT 'pending',
  `total_amount` decimal(10,2) NOT NULL,
  `payment_method` varchar(50) DEFAULT NULL,
  `payment_reference` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `pos_push_status` enum('pending','success','failed') DEFAULT NULL,
  `pos_push_response` text DEFAULT NULL,
  `pos_push_time` datetime DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payment_requests`
--

CREATE TABLE `payment_requests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `order_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(10,2) NOT NULL,
  `status` enum('PENDING','SUCCESS','FAILED') DEFAULT 'PENDING',
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `RestaurantReview`
--

CREATE TABLE `RestaurantReview` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `rating` int(1) NOT NULL CHECK (`rating` between 1 and 5),
  `comment` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Restaurants`
--

CREATE TABLE `Restaurants` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `external_id` varchar(50) DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `city` varchar(100) DEFAULT NULL,
  `state` varchar(100) DEFAULT NULL,
  `country` varchar(100) DEFAULT NULL,
  `contact` varchar(15) DEFAULT NULL,
  `latitude` decimal(10,7) DEFAULT NULL,
  `longitude` decimal(10,7) DEFAULT NULL,
  `minimum_order_amount` decimal(10,2) DEFAULT NULL,
  `minimum_prep_time` int(11) DEFAULT NULL,
  `delivery_charge` decimal(10,2) DEFAULT NULL,
  `packaging_charge` decimal(10,2) DEFAULT NULL,
  `merchant_vpa` varchar(255) DEFAULT NULL,
  `merchant_name` varchar(255) DEFAULT NULL,
  `menu_sharing_code` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp(),
  `payment_acceptance_type` enum('PAY_AND_PLACE','PAY_AT_END') NOT NULL DEFAULT 'PAY_AND_PLACE' COMMENT 'Determines when payment is required for orders'
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `Restaurants`
--

INSERT INTO `Restaurants` (`id`, `external_id`, `name`, `address`, `city`, `state`, `country`, `contact`, `latitude`, `longitude`, `minimum_order_amount`, `minimum_prep_time`, `delivery_charge`, `packaging_charge`, `merchant_vpa`, `merchant_name`, `menu_sharing_code`, `created_at`, `updated_at`, `payment_acceptance_type`) VALUES
(1, 'res_001', 'Tat Tvam Asi', 'Road No. 36, Jubilee Hills, Hyderabad', 'Hyderabad', 'Telangana', NULL, '9998696995', 17.4326000, 78.4078000, 0.00, 30, 40.00, 10.00, NULL, NULL, NULL, '2025-03-14 21:07:20', '2025-03-14 21:07:20', 'PAY_AT_END'),
(2, NULL, 'Spice Junction', 'Plot 22, Road No. 10, Banjara Hills', 'Hyderabad', 'Telangana', NULL, '9876543210', 17.4126000, 78.4356000, 0.00, 25, 60.00, 20.00, NULL, NULL, NULL, '2025-04-26 11:31:47', '2025-04-26 11:31:47', 'PAY_AND_PLACE'),
(3, NULL, 'Cloud Kitchen', '3rd Floor, Inorbit Mall, Hitech City', 'Hyderabad', 'Telangana', NULL, '8765432109', 17.4350000, 78.3820000, 0.00, 15, 50.00, 15.00, NULL, NULL, NULL, '2025-04-26 11:31:47', '2025-04-26 11:31:47', 'PAY_AT_END'),
(4, NULL, 'Urban Bites', 'Shop 12, GVK One Mall, Banjara Hills', 'Hyderabad', 'Telangana', NULL, '7654321098', 17.4200000, 78.4450000, 0.00, 35, 80.00, 25.00, NULL, NULL, NULL, '2025-04-26 11:31:47', '2025-04-26 11:31:47', 'PAY_AND_PLACE');

-- --------------------------------------------------------

--
-- Table structure for table `RestaurantTables`
--

CREATE TABLE `RestaurantTables` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `table_number` varchar(50) NOT NULL,
  `capacity` int(11) DEFAULT 4,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `RestaurantTables`
--

INSERT INTO `RestaurantTables` (`id`, `restaurant_id`, `table_number`, `capacity`, `is_active`, `created_at`, `updated_at`) VALUES
(1, 1, '1A', 2, 1, '2025-04-26 11:33:28', '2025-04-26 11:33:28'),
(2, 1, '2A', 4, 1, '2025-04-26 11:33:28', '2025-04-26 11:33:28'),
(3, 1, '3A', 6, 1, '2025-04-26 11:33:28', '2025-04-26 11:33:28'),
(4, 2, '1B', 2, 1, '2025-04-26 11:33:28', '2025-04-26 11:33:28'),
(5, 2, '2B', 4, 1, '2025-04-26 11:33:28', '2025-04-26 11:33:28'),
(6, 3, '1C', 2, 1, '2025-04-26 11:33:28', '2025-04-26 11:33:28'),
(7, 3, '2C', 4, 1, '2025-04-26 11:33:28', '2025-04-26 11:33:28'),
(8, 4, '1D', 2, 1, '2025-04-26 11:33:28', '2025-04-26 11:33:28'),
(9, 4, '2D', 4, 1, '2025-04-26 11:33:28', '2025-04-26 11:33:28');

-- --------------------------------------------------------

--
-- Table structure for table `restaurant_pos_integrations`
--

CREATE TABLE `restaurant_pos_integrations` (
  `id` int(11) NOT NULL,
  `restaurant_id` bigint(20) UNSIGNED NOT NULL,
  `pos_type` varchar(64) NOT NULL,
  `endpoint` varchar(255) NOT NULL,
  `api_key` varchar(255) DEFAULT NULL,
  `config` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`config`)),
  `active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `restaurant_pos_integrations`
--

INSERT INTO `restaurant_pos_integrations` (`id`, `restaurant_id`, `pos_type`, `endpoint`, `api_key`, `config`, `active`, `created_at`, `updated_at`) VALUES
(2, 1, 'petpooja', 'https://private-anon-0051655670-onlineorderingapisv210.apiary-mock.com/pushmenu_endpoint', NULL, '{\"restaurantid\":\"xxxxx\",\"menusharingcode\":\"xxxxxx\",\"ordertypes\": [{\"ordertypeid\":1,\"ordertype\":\"Delivery\"},{\"ordertypeid\":2,\"ordertype\":\"PickUp\"},{\"ordertypeid\":3,\"ordertype\":\"DineIn\"}],\"categories\": [{\"categoryid\":\"500773\",\"active\":\"1\",\"categoryrank\":\"16\",\"parent_category_id\":\"0\",\"categoryname\":\"Pizzaandsides\",\"group_category_id\":\"98\"},{\"categoryid\":\"500774\",\"active\":\"1\",\"categoryrank\":\"17\",\"parent_category_id\":\"0\",\"categoryname\":\"Cakes\",\"group_category_id\":\"99\"}],\"parentcategories\":[],\"group_categories\":[{\"id\":\"98\",\"name\":\"Italian\",\"status\":\"1\",\"rank\":\"2\"},{\"id\":\"99\",\"name\":\"Bakery\",\"status\":\"1\",\"rank\":\"1\"}],\"items\":[],\"variations\":[],\"addongroups\":[],\"attributes\":[],\"discounts\":[],\"taxes\":[]}', 1, '2025-05-01 09:57:40', '2025-05-01 09:57:40');

-- --------------------------------------------------------

--
-- Table structure for table `Review`
--

CREATE TABLE `Review` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `item_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED NOT NULL,
  `rating` int(1) NOT NULL,
  `comment` text DEFAULT NULL,
  `created_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=MyISAM DEFAULT CHARSET=latin1 COLLATE=latin1_swedish_ci;

--
-- Dumping data for table `Review`
--

INSERT INTO `Review` (`id`, `item_id`, `user_id`, `rating`, `comment`, `created_at`) VALUES
(1, 1, 101, 3, 'Absolutely delicious!', '2025-04-17 17:42:41'),
(2, 1, 102, 4, 'Very tasty but a bit spicy.', '2025-04-17 17:42:41'),
(3, 1, 103, 3, 'Good, but could be crispier.', '2025-04-17 17:42:41'),
(4, 2, 104, 4, 'Loved it! Will order again.', '2025-04-17 17:42:41'),
(5, 2, 104, 5, 'Perfect Bite.', '2025-04-17 17:42:41'),
(6, 3, 104, 5, 'Sweet, Recommended', '2025-04-17 17:42:41');

-- --------------------------------------------------------

--
-- Table structure for table `Sessions`
--

CREATE TABLE `Sessions` (
  `session_id` varchar(100) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Users`
--

CREATE TABLE `Users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `role` enum('ADMIN','CUSTOMER','RESTAURANT_OWNER') DEFAULT 'CUSTOMER',
  `name` varchar(255) NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `phone_number` varchar(15) NOT NULL,
  `password_hash` text NOT NULL,
  `last_login` timestamp NULL DEFAULT current_timestamp() ON UPDATE current_timestamp(),
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

-- --------------------------------------------------------

--
-- Table structure for table `Variations`
--

CREATE TABLE `Variations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `external_id` varchar(50) DEFAULT NULL,
  `item_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `price` decimal(10,2) NOT NULL,
  `is_active` tinyint(1) DEFAULT 1,
  `created_at` timestamp NULL DEFAULT current_timestamp(),
  `updated_at` timestamp NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Dumping data for table `Variations`
--

INSERT INTO `Variations` (`id`, `external_id`, `item_id`, `name`, `price`, `is_active`, `created_at`, `updated_at`) VALUES
(1, '89058', 1, '3 Pieces', 140.00, 1, '2025-03-14 21:13:56', '2025-03-14 21:13:56'),
(2, '89059', 1, '6 Pieces', 260.00, 1, '2025-03-14 21:13:56', '2025-03-14 21:13:56'),
(3, NULL, 4, 'Regular (8 pieces)', 220.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(4, NULL, 4, 'Large (12 pieces)', 320.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(5, NULL, 6, 'Half Portion', 320.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(6, NULL, 6, 'Full Portion', 560.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(7, NULL, 15, 'Single Patty', 280.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(8, NULL, 15, 'Double Patty', 380.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(9, NULL, 16, 'Regular', 240.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48'),
(10, NULL, 16, 'Deluxe with Fries', 320.00, 1, '2025-04-26 11:31:48', '2025-04-26 11:31:48');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `AddOnGroups`
--
ALTER TABLE `AddOnGroups`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `external_id` (`external_id`),
  ADD KEY `restaurant_id` (`restaurant_id`);

--
-- Indexes for table `AddOnItems`
--
ALTER TABLE `AddOnItems`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `external_id` (`external_id`),
  ADD KEY `addon_group_id` (`addon_group_id`);

--
-- Indexes for table `Cart`
--
ALTER TABLE `Cart`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `restaurant_id` (`restaurant_id`),
  ADD KEY `order_group_id` (`order_group_id`),
  ADD KEY `idx_cart_user_restaurant` (`user_id`,`restaurant_id`,`is_finalized`),
  ADD KEY `idx_cart_session_restaurant` (`session_id`,`restaurant_id`,`is_finalized`);

--
-- Indexes for table `CartItemAddOns`
--
ALTER TABLE `CartItemAddOns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cart_item_id` (`cart_item_id`),
  ADD KEY `addon_id` (`addon_id`);

--
-- Indexes for table `CartItems`
--
ALTER TABLE `CartItems`
  ADD PRIMARY KEY (`id`),
  ADD KEY `cart_id` (`cart_id`),
  ADD KEY `item_id` (`item_id`),
  ADD KEY `variation_id` (`variation_id`);

--
-- Indexes for table `Categories`
--
ALTER TABLE `Categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `external_id` (`external_id`),
  ADD KEY `restaurant_id` (`restaurant_id`);

--
-- Indexes for table `GroupParticipants`
--
ALTER TABLE `GroupParticipants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_participant` (`order_group_id`,`user_id`,`session_id`),
  ADD UNIQUE KEY `unique_group_user` (`order_group_id`,`user_id`),
  ADD UNIQUE KEY `unique_group_session` (`order_group_id`,`session_id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `order_group_id` (`order_group_id`);

--
-- Indexes for table `Items`
--
ALTER TABLE `Items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `external_id` (`external_id`),
  ADD KEY `restaurant_id` (`restaurant_id`),
  ADD KEY `category_id` (`category_id`);

--
-- Indexes for table `Item_Addon_Groups`
--
ALTER TABLE `Item_Addon_Groups`
  ADD PRIMARY KEY (`item_id`,`addon_group_id`),
  ADD KEY `addon_group_id` (`addon_group_id`);

--
-- Indexes for table `OrderGroups`
--
ALTER TABLE `OrderGroups`
  ADD PRIMARY KEY (`id`),
  ADD KEY `restaurant_id` (`restaurant_id`),
  ADD KEY `table_id` (`table_id`),
  ADD KEY `idx_session_id` (`session_id`),
  ADD KEY `idx_active_group_lookup` (`restaurant_id`,`table_id`,`group_status`);

--
-- Indexes for table `OrderItemAddOns`
--
ALTER TABLE `OrderItemAddOns`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_item_id` (`order_item_id`),
  ADD KEY `addon_id` (`addon_id`);

--
-- Indexes for table `OrderItems`
--
ALTER TABLE `OrderItems`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`),
  ADD KEY `item_id` (`item_id`),
  ADD KEY `variation_id` (`variation_id`);

--
-- Indexes for table `Orders`
--
ALTER TABLE `Orders`
  ADD PRIMARY KEY (`id`),
  ADD KEY `user_id` (`user_id`),
  ADD KEY `restaurant_id` (`restaurant_id`),
  ADD KEY `order_group_id` (`order_group_id`);

--
-- Indexes for table `payment_requests`
--
ALTER TABLE `payment_requests`
  ADD PRIMARY KEY (`id`),
  ADD KEY `order_id` (`order_id`);

--
-- Indexes for table `RestaurantReview`
--
ALTER TABLE `RestaurantReview`
  ADD PRIMARY KEY (`id`),
  ADD KEY `restaurant_id` (`restaurant_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `Restaurants`
--
ALTER TABLE `Restaurants`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `external_id` (`external_id`),
  ADD UNIQUE KEY `menu_sharing_code` (`menu_sharing_code`),
  ADD KEY `idx_restaurant_payment_type` (`payment_acceptance_type`);

--
-- Indexes for table `RestaurantTables`
--
ALTER TABLE `RestaurantTables`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `unique_table` (`restaurant_id`,`table_number`);

--
-- Indexes for table `restaurant_pos_integrations`
--
ALTER TABLE `restaurant_pos_integrations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `uniq_restaurant_pos_active` (`restaurant_id`,`pos_type`,`active`);

--
-- Indexes for table `Review`
--
ALTER TABLE `Review`
  ADD PRIMARY KEY (`id`),
  ADD KEY `item_id` (`item_id`);

--
-- Indexes for table `Sessions`
--
ALTER TABLE `Sessions`
  ADD PRIMARY KEY (`session_id`),
  ADD KEY `user_id` (`user_id`);

--
-- Indexes for table `Users`
--
ALTER TABLE `Users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `phone_number` (`phone_number`),
  ADD UNIQUE KEY `email` (`email`);

--
-- Indexes for table `Variations`
--
ALTER TABLE `Variations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `external_id` (`external_id`),
  ADD KEY `item_id` (`item_id`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `AddOnGroups`
--
ALTER TABLE `AddOnGroups`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `AddOnItems`
--
ALTER TABLE `AddOnItems`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=29;

--
-- AUTO_INCREMENT for table `Cart`
--
ALTER TABLE `Cart`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `CartItemAddOns`
--
ALTER TABLE `CartItemAddOns`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `CartItems`
--
ALTER TABLE `CartItems`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Categories`
--
ALTER TABLE `Categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=18;

--
-- AUTO_INCREMENT for table `GroupParticipants`
--
ALTER TABLE `GroupParticipants`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Items`
--
ALTER TABLE `Items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=25;

--
-- AUTO_INCREMENT for table `OrderGroups`
--
ALTER TABLE `OrderGroups`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `OrderItemAddOns`
--
ALTER TABLE `OrderItemAddOns`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `OrderItems`
--
ALTER TABLE `OrderItems`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Orders`
--
ALTER TABLE `Orders`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payment_requests`
--
ALTER TABLE `payment_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `RestaurantReview`
--
ALTER TABLE `RestaurantReview`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=15;

--
-- AUTO_INCREMENT for table `Restaurants`
--
ALTER TABLE `Restaurants`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `RestaurantTables`
--
ALTER TABLE `RestaurantTables`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `restaurant_pos_integrations`
--
ALTER TABLE `restaurant_pos_integrations`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=3;

--
-- AUTO_INCREMENT for table `Review`
--
ALTER TABLE `Review`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `Users`
--
ALTER TABLE `Users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `Variations`
--
ALTER TABLE `Variations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `AddOnGroups`
--
ALTER TABLE `AddOnGroups`
  ADD CONSTRAINT `addongroups_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `AddOnItems`
--
ALTER TABLE `AddOnItems`
  ADD CONSTRAINT `addonitems_ibfk_1` FOREIGN KEY (`addon_group_id`) REFERENCES `AddOnGroups` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `Cart`
--
ALTER TABLE `Cart`
  ADD CONSTRAINT `cart_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `cart_ibfk_2` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `cart_ibfk_3` FOREIGN KEY (`order_group_id`) REFERENCES `OrderGroups` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `CartItemAddOns`
--
ALTER TABLE `CartItemAddOns`
  ADD CONSTRAINT `cartitemaddons_ibfk_1` FOREIGN KEY (`cart_item_id`) REFERENCES `CartItems` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `cartitemaddons_ibfk_2` FOREIGN KEY (`addon_id`) REFERENCES `AddOnItems` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `CartItems`
--
ALTER TABLE `CartItems`
  ADD CONSTRAINT `cartitems_ibfk_1` FOREIGN KEY (`cart_id`) REFERENCES `Cart` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `cartitems_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `Items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `cartitems_ibfk_3` FOREIGN KEY (`variation_id`) REFERENCES `Variations` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `Categories`
--
ALTER TABLE `Categories`
  ADD CONSTRAINT `categories_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `GroupParticipants`
--
ALTER TABLE `GroupParticipants`
  ADD CONSTRAINT `groupparticipants_ibfk_1` FOREIGN KEY (`order_group_id`) REFERENCES `OrderGroups` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `groupparticipants_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `Items`
--
ALTER TABLE `Items`
  ADD CONSTRAINT `items_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `items_ibfk_2` FOREIGN KEY (`category_id`) REFERENCES `Categories` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `Item_Addon_Groups`
--
ALTER TABLE `Item_Addon_Groups`
  ADD CONSTRAINT `item_addon_groups_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `Items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `item_addon_groups_ibfk_2` FOREIGN KEY (`addon_group_id`) REFERENCES `AddOnGroups` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `OrderGroups`
--
ALTER TABLE `OrderGroups`
  ADD CONSTRAINT `ordergroups_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `ordergroups_ibfk_2` FOREIGN KEY (`table_id`) REFERENCES `RestaurantTables` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `OrderItemAddOns`
--
ALTER TABLE `OrderItemAddOns`
  ADD CONSTRAINT `orderitemaddons_ibfk_1` FOREIGN KEY (`order_item_id`) REFERENCES `OrderItems` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orderitemaddons_ibfk_2` FOREIGN KEY (`addon_id`) REFERENCES `AddOnItems` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `OrderItems`
--
ALTER TABLE `OrderItems`
  ADD CONSTRAINT `orderitems_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `Orders` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orderitems_ibfk_2` FOREIGN KEY (`item_id`) REFERENCES `Items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orderitems_ibfk_3` FOREIGN KEY (`variation_id`) REFERENCES `Variations` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `Orders`
--
ALTER TABLE `Orders`
  ADD CONSTRAINT `orders_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orders_ibfk_2` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `orders_ibfk_3` FOREIGN KEY (`order_group_id`) REFERENCES `OrderGroups` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payment_requests`
--
ALTER TABLE `payment_requests`
  ADD CONSTRAINT `payment_requests_ibfk_1` FOREIGN KEY (`order_id`) REFERENCES `Orders` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `RestaurantReview`
--
ALTER TABLE `RestaurantReview`
  ADD CONSTRAINT `restaurantreviews_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `restaurantreviews_ibfk_2` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `RestaurantTables`
--
ALTER TABLE `RestaurantTables`
  ADD CONSTRAINT `restauranttables_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `Restaurants` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `restaurant_pos_integrations`
--
ALTER TABLE `restaurant_pos_integrations`
  ADD CONSTRAINT `restaurant_pos_integrations_ibfk_1` FOREIGN KEY (`restaurant_id`) REFERENCES `restaurants` (`id`);

--
-- Constraints for table `Sessions`
--
ALTER TABLE `Sessions`
  ADD CONSTRAINT `sessions_ibfk_1` FOREIGN KEY (`user_id`) REFERENCES `Users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `Variations`
--
ALTER TABLE `Variations`
  ADD CONSTRAINT `variations_ibfk_1` FOREIGN KEY (`item_id`) REFERENCES `Items` (`id`) ON DELETE CASCADE;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
