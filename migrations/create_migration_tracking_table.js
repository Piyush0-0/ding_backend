const db = require('../db');

async function up() {
    const connection = await db.getConnection();
    
    try {
        console.log('Creating migration tracking table...');
        
        await connection.query(`
            CREATE TABLE IF NOT EXISTS migrations (
                id INT AUTO_INCREMENT PRIMARY KEY,
                migration_name VARCHAR(255) NOT NULL UNIQUE,
                executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                execution_time_ms INT,
                status ENUM('success', 'failed') DEFAULT 'success',
                error_message TEXT NULL
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci
        `);
        
        console.log('✅ Migration tracking table created successfully');
        
    } catch (error) {
        console.error('❌ Error creating migration tracking table:', error);
        throw error;
    } finally {
        connection.release();
    }
}

async function down() {
    const connection = await db.getConnection();
    
    try {
        console.log('Dropping migration tracking table...');
        await connection.query('DROP TABLE IF EXISTS migrations');
        console.log('✅ Migration tracking table dropped successfully');
    } catch (error) {
        console.error('❌ Error dropping migration tracking table:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { up, down }; 