// Apply public/schema/live/parivar.sql (idempotent: CREATE TABLE IF NOT EXISTS).
// Works on MySQL 8 and MariaDB 10.6+.
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const db = process.env.DB_NAME || 'parivar';
const base = {
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    multipleStatements: true,
    charset: 'utf8mb4_unicode_ci',
};

let conn;
try {
    conn = await mysql.createConnection({ ...base, database: db });
} catch (err) {
    // Only create the database when it is genuinely missing: shared hosting accounts
    // usually lack CREATE DATABASE, and MariaDB checks the privilege even with IF NOT EXISTS.
    if (err.code !== 'ER_BAD_DB_ERROR') throw err;
    conn = await mysql.createConnection(base);
    await conn.query(`CREATE DATABASE \`${db}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci`);
    await conn.query(`USE \`${db}\``);
}
await conn.query(await readFile(new URL('../public/schema/live/parivar.sql', import.meta.url), 'utf8'));
const [tables] = await conn.query('SHOW TABLES');
console.log(`Applied schema to ${db}: ${tables.length} tables`);
console.log(tables.map((r) => Object.values(r)[0]).join(', '));
await conn.end();
