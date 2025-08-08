-- Dummy events for restaurant_id = 1
INSERT INTO `Events` (`restaurant_id`, `name`, `description`, `image_url`, `event_time`, `category_id`, `subcategory_id`, `is_active`, `metadata`) VALUES
(1, 'Live Jazz Wednesdays', 'Enjoy a relaxing evening with live jazz music from local artists. Happy hour specials all night.', 'https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=1080', NOW() + INTERVAL 1 DAY, 1, 1, 1, '{"artist": "The Cool Cats Trio"}'),
(1, 'Wine Tasting Gala', 'A curated selection of international and local wines. Paired with exquisite cheeses and hors d''oeuvres.', 'https://images.unsplash.com/photo-1599999613562-b91c7a5f7e2d?w=1080', NOW() + INTERVAL 5 DAY, 4, 13, 1, '{"featured_winery": "Napa Valley Wines"}'),
(1, 'Inactive Past Event', 'This is an example of an event that is not active.', 'https://images.unsplash.com/photo-1504711434969-e33886168f5c?w=1080', NOW() - INTERVAL 2 DAY, 2, 5, 0, NULL);

-- Dummy events for restaurant_id = 2
INSERT INTO `Events` (`restaurant_id`, `name`, `description`, `image_url`, `event_time`, `category_id`, `subcategory_id`, `is_active`, `metadata`) VALUES
(2, 'Street Food Fiesta', 'Explore a variety of street food from around the world. A fun-filled day for the whole family.', 'https://images.unsplash.com/photo-1563212170-435057039206?w=1080', NOW() + INTERVAL 3 DAY, 2, 5, 1, '{"cuisine_focus": "Global"}'),
(2, 'Baking Masterclass', 'Learn the art of baking from our head pastry chef. Limited spots available, book now!', 'https://images.unsplash.com/photo-1588195538326-c5b1e9f80a1b?w=1080', NOW() + INTERVAL 10 DAY, 3, 11, 1, '{"chef": "Anna Olson", "skill_level": "Intermediate"}'); 