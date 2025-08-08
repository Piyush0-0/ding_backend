const fs = require('fs');
const path = require('path');
const db = require('./db');

const sqlMigrationsDir = path.join(__dirname, 'db_migrations');

async function ensureMigrationTable() {
    const connection = await db.getConnection();
    try {
        await connection.query(`
            CREATE TABLE IF NOT EXISTS sql_migrations (
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

async function getExecutedSqlMigrations() {
    const connection = await db.getConnection();
    try {
        const [rows] = await connection.query('SELECT migration_name FROM sql_migrations WHERE status = "success"');
        return rows.map(row => row.migration_name);
    } finally {
        connection.release();
    }
}

async function recordSqlMigration(migrationName, executionTime, status = 'success', errorMessage = null) {
    const connection = await db.getConnection();
    try {
        await connection.query(
            'INSERT INTO sql_migrations (migration_name, execution_time_ms, status, error_message) VALUES (?, ?, ?, ?) ON DUPLICATE KEY UPDATE executed_at = CURRENT_TIMESTAMP, execution_time_ms = ?, status = ?, error_message = ?',
            [migrationName, executionTime, status, errorMessage, executionTime, status, errorMessage]
        );
    } finally {
        connection.release();
    }
}

async function executeSqlFile(filePath) {
    const connection = await db.getConnection();
    try {
        const sqlContent = fs.readFileSync(filePath, 'utf8');
        
        // Split SQL content by semicolon and execute each statement
        const statements = sqlContent
            .split(';')
            .map(stmt => stmt.trim())
            .filter(stmt => stmt.length > 0 && !stmt.startsWith('--'));
        
        for (const statement of statements) {
            if (statement.trim()) {
                await connection.query(statement);
            }
        }
    } finally {
        connection.release();
    }
}

async function run() {
    const args = process.argv.slice(2);
    const command = args[0]; // up or down
    const specificMigrationFile = args[1]; // optional specific file to run

    if (!command || (command !== 'up' && command !== 'down')) {
        console.error('Usage: node run-sql-migration.js <up|down> [migration_file.sql]');
        console.error('Note: SQL migrations only support "up" command (no rollback)');
        process.exit(1);
    }

    if (command === 'down') {
        console.error('❌ SQL migrations do not support rollback. Use database backup to restore.');
        process.exit(1);
    }

    // Ensure migration tracking table exists
    await ensureMigrationTable();

    let filesToRun = [];

    if (specificMigrationFile) {
        filesToRun.push(specificMigrationFile);
    } else {
        filesToRun = fs.readdirSync(sqlMigrationsDir)
            .filter(file => file.endsWith('.sql') && file !== 'dingrms_backup.sql')
            .sort();
    }

    const executedMigrations = await getExecutedSqlMigrations();

    for (const file of filesToRun) {
        const migrationPath = path.join(sqlMigrationsDir, file);
        if (fs.existsSync(migrationPath)) {
            
            // Skip if migration already executed
            if (executedMigrations.includes(file)) {
                console.log(`⏭️  Skipping ${file} - already executed`);
                continue;
            }

            console.log(`Running SQL migration: ${file}...`);
            const startTime = Date.now();
            
            try {
                await executeSqlFile(migrationPath);
                const executionTime = Date.now() - startTime;
                await recordSqlMigration(file, executionTime, 'success');
                console.log(`✅ SQL migration ${file} completed in ${executionTime}ms`);
            } catch (error) {
                const executionTime = Date.now() - startTime;
                await recordSqlMigration(file, executionTime, 'failed', error.message);
                console.error(`❌ Error running SQL migration ${file}:`, error);
                process.exit(1); 
            }
        } else {
            console.error(`SQL migration file not found: ${migrationPath}`);
        }
    }

    console.log('All SQL migrations executed successfully.');
    await db.close();
}

run(); 