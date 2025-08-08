const db = require('../db');

class Restaurant {
    static async findById(id) {
        const [restaurants] = await db.query(
            'SELECT * FROM Restaurants WHERE id = ?',
            [id]
        );
        return restaurants[0];
    }

    static async findByOwnerId(ownerId) {
        const [restaurants] = await db.query(
            'SELECT * FROM Restaurants WHERE created_by_user_id = ?',
            [ownerId]
        );
        return restaurants;
    }

    static async verifyOwnership(restaurantId, userId) {
        const [restaurants] = await db.query(
            'SELECT * FROM Restaurants WHERE id = ? AND created_by_user_id = ?',
            [restaurantId, userId]
        );
        return restaurants.length > 0;
    }
}

module.exports = Restaurant; 