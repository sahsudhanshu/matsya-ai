const fs = require('fs');
const path = require('path');
const mysql = require('mysql2/promise');
require('dotenv').config();

// Tables in reverse dependency order so FK constraints don't block drops
const TABLES_TO_DROP = [
    'fish_knowledge',
    'telegram_subs',
    'memory',
    'messages',
    'conversations',
    'chats',
    'images',
    '`groups`',
    'users',
];

async function run() {
    const sslEnabled = process.env.DB_SSL === 'true';

    const connection = await mysql.createConnection({
        host:     process.env.DB_HOST || 'localhost',
        port:     parseInt(process.env.DB_PORT || '3306', 10),
        user:     process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'defaultdb',
        multipleStatements: true,
        ...(sslEnabled && { ssl: { rejectUnauthorized: false } })
    });

    try {
        console.log('Disabling FK checks...');
        await connection.query('SET FOREIGN_KEY_CHECKS = 0;');

        for (const table of TABLES_TO_DROP) {
            console.log(`  Dropping table ${table} if exists...`);
            await connection.query(`DROP TABLE IF EXISTS ${table};`);
        }

        await connection.query('SET FOREIGN_KEY_CHECKS = 1;');
        console.log('All existing tables dropped.\n');

        // Load init file (works from backend/ or any subdirectory)
        const sqlFile = path.resolve(__dirname, '../infrastructure/init.sql');
        const sqlChunks = fs.readFileSync(sqlFile, 'utf8');

        console.log('Executing init.sql...');
        await connection.query(sqlChunks);
        console.log('All tables recreated successfully!');
    } catch (err) {
        console.error('Error recreating tables:', err.message);
        process.exit(1);
    } finally {
        await connection.end();
    }
}

run().catch(console.error);

