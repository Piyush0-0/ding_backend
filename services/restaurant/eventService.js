const Event = require('../../models/Event');
const Restaurant = require('../../models/Restaurant');

class EventService {
    static async createEvent(eventData, userId) {
        // Verify restaurant ownership
        const isOwner = await Restaurant.verifyOwnership(eventData.restaurant_id, userId);
        if (!isOwner) {
            throw new Error('Not authorized to create events for this restaurant');
        }

        // Create event
        const eventId = await Event.create(eventData);
        return await Event.findById(eventId);
    }

    static async getEvent(eventId) {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }
        return event;
    }

    static async getRestaurantEvents(restaurantId, filterOptions = {}) {
        return await Event.findByRestaurantId(restaurantId, filterOptions);
    }

    static async updateEvent(eventId, eventData, userId) {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        // Verify restaurant ownership
        const isOwner = await Restaurant.verifyOwnership(event.restaurant_id, userId);
        if (!isOwner) {
            throw new Error('Not authorized to update this event');
        }

        const success = await Event.update(eventId, eventData);
        if (!success) {
            throw new Error('Failed to update event');
        }

        return await Event.findById(eventId);
    }

    static async deleteEvent(eventId, userId) {
        const event = await Event.findById(eventId);
        if (!event) {
            throw new Error('Event not found');
        }

        // Verify restaurant ownership
        const isOwner = await Restaurant.verifyOwnership(event.restaurant_id, userId);
        if (!isOwner) {
            throw new Error('Not authorized to delete this event');
        }

        const success = await Event.delete(eventId);
        if (!success) {
            throw new Error('Failed to delete event');
        }

        return true;
    }

    static async getEventCategories() {
        // This method will be simple as Event.getEventCategories will do the DB query
        return await Event.getEventCategories(); 
    }

    static async getEventSubcategories(categoryId) {
        // This method will be simple as Event.getEventSubcategories will do the DB query
        return await Event.getEventSubcategories(categoryId);
    }
}

module.exports = EventService; 