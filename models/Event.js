const db = require('../db');

class Event {
    static async create(eventData) {
        const [result] = await db.query(`
            INSERT INTO Events (
                restaurant_id, name, description, image_url, 
                event_time, category_id, subcategory_id, metadata
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
            eventData.restaurant_id,
            eventData.name,
            eventData.description,
            eventData.image_url,
            eventData.event_time,
            eventData.category_id,
            eventData.subcategory_id,
            eventData.metadata ? JSON.stringify(eventData.metadata) : null
        ]);
        return result.insertId;
    }

    static async findById(id) {
        const events = await db.query(
            'SELECT * FROM Events WHERE id = ?',
            [id]
        );
        return events[0];
    }

    static async findByRestaurantId(restaurantId, options = {}) {
        const { category_id, subcategory_id, is_active } = options;

        let query = `
            SELECT e.*,
                   ec.name as category_name,
                   sc.name as subcategory_name
            FROM Events e
            JOIN EventCategories ec ON e.category_id = ec.id
            JOIN SubCategories sc ON e.subcategory_id = sc.id
            WHERE e.restaurant_id = ?
        `;
        const params = [restaurantId];

        if (category_id) {
            query += ' AND e.category_id = ?';
            params.push(category_id);
        }
        if (subcategory_id) {
            query += ' AND e.subcategory_id = ?';
            params.push(subcategory_id);
        }
        if (is_active !== undefined) {
            query += ' AND e.is_active = ?';
            params.push(is_active === 'true' || is_active === true || is_active === 1 ? 1 : 0);
        }

        query += ' ORDER BY e.event_time ASC';

        const events = await db.query(query, params);
        return events;
    }

    static async update(id, eventData) {
        const [result] = await db.query(`
            UPDATE Events 
            SET name = ?, description = ?, image_url = ?, 
                event_time = ?, category_id = ?, subcategory_id = ?, 
                metadata = ?
            WHERE id = ?
        `, [
            eventData.name,
            eventData.description,
            eventData.image_url,
            eventData.event_time,
            eventData.category_id,
            eventData.subcategory_id,
            eventData.metadata ? JSON.stringify(eventData.metadata) : null,
            id
        ]);
        return result.affectedRows > 0;
    }

    static async delete(id) {
        const [result] = await db.query(
            'DELETE FROM Events WHERE id = ?',
            [id]
        );
        return result.affectedRows > 0;
    }

    static async getEventCategories() {
        const categories = await db.query(`
            SELECT * FROM EventCategories 
            WHERE is_active = 1 
            ORDER BY name
        `);
        return categories;
    }

    static async getEventSubcategories(categoryId) {
        const subcategories = await db.query(`
            SELECT * FROM SubCategories 
            WHERE category_id = ? AND is_active = 1 
            ORDER BY name
        `, [categoryId]);
        return subcategories;
    }
}

module.exports = Event; 