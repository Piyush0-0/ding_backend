const EventService = require('../services/restaurant/eventService');

class EventController {
    static async createEvent(req, res) {
        try {
            const eventData = {
                ...req.body,
                restaurant_id: req.params.restaurantId
            };
            const event = await EventService.createEvent(eventData, req.user.id);
            res.status(201).json(event);
        } catch (error) {
            if (error.message.includes('Not authorized')) {
                return res.status(403).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to create event' });
        }
    }

    static async getEvent(req, res) {
        try {
            const event = await EventService.getEvent(req.params.eventId);
            res.json(event);
        } catch (error) {
            if (error.message === 'Event not found') {
                return res.status(404).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to get event' });
        }
    }

    static async getRestaurantEvents(req, res) {
        try {
            const { restaurantId } = req.params;
            const { category_id, subcategory_id, is_active } = req.query;
            const filterOptions = { category_id, subcategory_id, is_active };

            const events = await EventService.getRestaurantEvents(restaurantId, filterOptions);
            res.json(events);
        } catch (error) {
            res.status(500).json({ error: 'Failed to get restaurant events' });
        }
    }

    static async updateEvent(req, res) {
        try {
            const event = await EventService.updateEvent(
                req.params.eventId,
                req.body,
                req.user.id
            );
            res.json(event);
        } catch (error) {
            if (error.message === 'Event not found') {
                return res.status(404).json({ error: error.message });
            }
            if (error.message.includes('Not authorized')) {
                return res.status(403).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to update event' });
        }
    }

    static async deleteEvent(req, res) {
        try {
            await EventService.deleteEvent(req.params.eventId, req.user.id);
            res.status(204).send();
        } catch (error) {
            if (error.message === 'Event not found') {
                return res.status(404).json({ error: error.message });
            }
            if (error.message.includes('Not authorized')) {
                return res.status(403).json({ error: error.message });
            }
            res.status(500).json({ error: 'Failed to delete event' });
        }
    }

    static async getEventCategories(req, res) {
        try {
            const categories = await EventService.getEventCategories();
            res.json({ success: true, categories }); // Ensuring consistent response structure
        } catch (error) {
            console.error('Error fetching event categories:', error);
            res.status(500).json({ error: 'Failed to fetch event categories' });
        }
    }

    static async getEventSubcategories(req, res) {
        try {
            const { categoryId } = req.params;
            const subcategories = await EventService.getEventSubcategories(categoryId);
            res.json({ success: true, subcategories }); // Ensuring consistent response structure
        } catch (error) {
            console.error('Error fetching event subcategories:', error);
            res.status(500).json({ error: 'Failed to fetch event subcategories' });
        }
    }
}

module.exports = EventController; 