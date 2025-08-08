# Database Migration Guide

This guide explains how database migrations work in the `ding-mvp` project and how to manage schema changes across your team.

## Overview

The project uses a **dual migration system**:

1. **JavaScript Migrations** (`migrations/` folder) - For complex migrations with rollback support
2. **SQL Migrations** (`db_migrations/` folder) - For simple SQL schema changes

## Migration Tracking

Both systems now track executed migrations in database tables:
- `migrations` - Tracks JavaScript migrations
- `sql_migrations` - Tracks SQL migrations

This prevents duplicate execution and provides audit trails.

## How to Use Migrations

### For JavaScript Migrations

```bash
# Run all pending JavaScript migrations
npm run migrate

# Run a specific migration
node run-migration.js up 20231027_add_pos_restaurant_id.js

# Rollback last migration
npm run migrate:down

# Rollback specific migration
node run-migration.js down 20231027_add_pos_restaurant_id.js
```

### For SQL Migrations

```bash
# Run all pending SQL migrations
npm run migrate:sql

# Run a specific SQL migration
node run-sql-migration.js up add_stock_history_table.sql
```

### Check Migration Status

```bash
# View all executed migrations
npm run migrate:status
```

## Workflow for Team Collaboration

### When You Make Schema Changes:

1. **Create a new migration file** in the appropriate folder:
   - Use `migrations/` for complex changes with rollback
   - Use `db_migrations/` for simple SQL changes

2. **Follow naming conventions**:
   - JavaScript: `YYYYMMDD_description.js` (e.g., `20240315_add_user_roles.js`)
   - SQL: `descriptive_name.sql` (e.g., `add_user_roles.sql`)

3. **Test your migration locally**:
   ```bash
   npm run migrate:sql  # for SQL migrations
   npm run migrate      # for JavaScript migrations
   ```

4. **Commit and push to git**:
   ```bash
   git add migrations/your_migration.js
   git commit -m "Add migration: description"
   git push
   ```

### When Your Coworker Pulls Changes:

1. **Pull the latest code**:
   ```bash
   git pull origin main
   ```

2. **Run pending migrations**:
   ```bash
   # Run all pending migrations
   npm run migrate:sql
   npm run migrate
   
   # Or check what needs to be run
   npm run migrate:status
   ```

3. **Verify the changes**:
   ```bash
   npm run migrate:status
   ```

## Migration File Structure

### JavaScript Migration Template

```javascript
const db = require('../db');

async function up() {
    const connection = await db.getConnection();
    
    try {
        console.log('Description of what this migration does...');
        
        await connection.query(`
            -- Your SQL here
            ALTER TABLE table_name ADD COLUMN new_column VARCHAR(255);
        `);
        
        console.log('✅ Migration completed successfully');
        
    } catch (error) {
        console.error('❌ Error in migration:', error);
        throw error;
    } finally {
        connection.release();
    }
}

async function down() {
    const connection = await db.getConnection();
    
    try {
        console.log('Rolling back migration...');
        
        await connection.query(`
            -- Rollback SQL here
            ALTER TABLE table_name DROP COLUMN new_column;
        `);
        
        console.log('✅ Rollback completed successfully');
    } catch (error) {
        console.error('❌ Error in rollback:', error);
        throw error;
    } finally {
        connection.release();
    }
}

module.exports = { up, down };
```

### SQL Migration Template

```sql
-- Migration: Add new feature to table
-- Created: 2024-03-15
-- Purpose: Add support for new functionality

-- Add new columns
ALTER TABLE table_name 
ADD COLUMN new_column VARCHAR(255) DEFAULT NULL COMMENT 'Description of the column';

-- Create indexes for performance
CREATE INDEX idx_table_name_new_column ON table_name(new_column);

-- Insert default data if needed
INSERT INTO table_name (new_column) VALUES ('default_value') WHERE new_column IS NULL;
```

## Best Practices

### 1. **Always Test Migrations**
- Test on a copy of production data
- Verify rollback works for JavaScript migrations
- Check that indexes are created for performance

### 2. **Use Descriptive Names**
- Migration names should clearly describe what they do
- Include the date in JavaScript migration names
- Use lowercase with underscores for SQL files

### 3. **Handle Data Carefully**
- Use `IF NOT EXISTS` for table creation
- Use `IF EXISTS` for dropping columns/tables
- Consider data migration for existing records

### 4. **Document Complex Changes**
- Add comments explaining the purpose
- Document any business logic in the migration
- Include rollback instructions for manual operations

### 5. **Coordinate with Team**
- Communicate schema changes in team meetings
- Use pull requests for migration reviews
- Test migrations in staging before production

## Troubleshooting

### Migration Already Executed
If you see "already executed" messages, the migration system is working correctly. It's preventing duplicate execution.

### Migration Failed
1. Check the error message in the console
2. Look at the `migrations` or `sql_migrations` table for error details
3. Fix the issue and re-run the migration

### Manual Rollback Needed
For SQL migrations (which don't support automatic rollback):
1. Create a backup of your database
2. Manually reverse the changes
3. Remove the migration record from `sql_migrations` table

### Database Connection Issues
Ensure your database connection is properly configured in `db.js` and environment variables are set.

## Migration Status Commands

```bash
# View all migrations
npm run migrate:status

# Check specific migration
mysql -u username -p database_name -e "SELECT * FROM migrations WHERE migration_name = 'your_migration.js';"

# View failed migrations
mysql -u username -p database_name -e "SELECT * FROM migrations WHERE status = 'failed';"
```

## Security Notes

- Never commit database credentials in migration files
- Use environment variables for database connections
- Be careful with DROP statements in production
- Always backup before running migrations in production

## Production Deployment

1. **Backup the database** before running migrations
2. **Run migrations during maintenance windows**
3. **Monitor the application** after migration
4. **Have a rollback plan** ready

```bash
# Production migration checklist
npm run migrate:status  # Check current state
npm run migrate:sql     # Run SQL migrations first
npm run migrate         # Run JavaScript migrations
npm run migrate:status  # Verify all migrations completed
``` 