const express = require('express');
const router = express.Router();
// No longer need: const db = require('../db');
const EventController = require('../controllers/eventController');
const { authenticateUser } = require('../middlewares/authenticateUser');

// Apply authentication middleware to all routes
// router.use(authenticateUser);

// Get all event categories
router.get('/categories', EventController.getEventCategories);

// Get subcategories for a category
router.get('/categories/:categoryId/subcategories', EventController.getEventSubcategories);

// Create a new event for a restaurant
router.post('/restaurants/:restaurantId/events', EventController.createEvent);

// Get all events for a restaurant
router.get('/restaurants/:restaurantId/events', EventController.getRestaurantEvents);

// Get a specific event
router.get('/:eventId', EventController.getEvent);

// Update an event
router.put('/:eventId', EventController.updateEvent);

// Delete an event
router.delete('/:eventId', EventController.deleteEvent);

module.exports = router; 