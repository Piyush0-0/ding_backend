const fs = require('fs');
const path = require('path');
const db = require('./db');

const migrationsDir = path.join(__dirname, 'migrations');

async function ensureMigrationTable() {
    const connection = await db.getConnection();
    try {
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
    } finally {
        connection.release();
    }
}

async function getExecutedMigrations() {
    const connection = await db.getConnection();
    try {
        const [rows] = await connection.query('SELECT migration_name FROM migrations WHERE status = "success"');
        return rows.map(row => row.migration_name);
    } finally {
        connection.release();
    }
}

async function recordMigration(migrationName, executionTime, status = 'success', errorMessage = null) {
    const connection = await db.getConnection();
    try {
        await connection.query(
            'INSERT INTO migrations (migration_name, execution_time_ms, status, error_message) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP, execution_time_ms = ?, status = ?, error_message = ?',
            [migrationName, executionTime, status, errorMessage, executionTime, status, errorMessage]
        );
    } finally {
        connection.release();
    }
}

async function run() {
    const args = process.argv.slice(2);
    const command = args[0]; // up or down
    const specificMigrationFile = args[1]; // optional specific file to run

    if (!command || (command !== 'up' && command !== 'down')) {
        console.error('Usage: node run-migration.js <up|down> [migration_file.js]');
        process.exit(1);
    }

    // Ensure migration tracking table exists
    await ensureMigrationTable();

    let filesToRun = [];

    if (specificMigrationFile) {
        filesToRun.push(specificMigrationFile);
    } else {
        filesToRun = fs.readdirSync(migrationsDir).filter(file => file.endsWith('.js')).sort();
    }
    
    if (command === 'down') {
        filesToRun.reverse();
    }

    const executedMigrations = await getExecutedMigrations();

    for (const file of filesToRun) {
        const migrationPath = path.join(migrationsDir, file);
        if (fs.existsSync(migrationPath)) {
            const migration = require(migrationPath);
            if (migration[command] && typeof migration[command] === 'function') {
                
                // Skip if migration already executed (for 'up' command)
                if (command === 'up' && executedMigrations.includes(file)) {
                    console.log(`⏭️  Skipping ${file} - already executed`);
                    continue;
                }

                console.log(`Running ${command} for ${file}...`);
                const startTime = Date.now();
                
                try {
                    await migration[command]();
                    const executionTime = Date.now() - startTime;
                    await recordMigration(file, executionTime, 'success');
                    console.log(`✅ ${command} for ${file} completed in ${executionTime}ms`);
                } catch (error) {
                    const executionTime = Date.now() - startTime;
                    await recordMigration(file, executionTime, 'failed', error.message);
                    console.error(`❌ Error running ${command} for ${file}:`, error);
                    process.exit(1); 
                }
            } else {
                console.log(`No '${command}' function found in ${file}. Skipping.`);
            }
        } else {
            console.error(`Migration file not found: ${migrationPath}`);
        }
    }

    console.log('All migrations executed successfully.');
    await db.close();
}

run(); 