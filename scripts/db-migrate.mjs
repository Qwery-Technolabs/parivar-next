// Run one migration file statement by statement, honouring the mysql CLI's DELIMITER
// directive (mysql2 cannot send it), so the same file works in `mysql < file.sql` too.
//   npm run db:migrate -- public/schema/migrations/20260929180000-....sql
import { readFile } from 'node:fs/promises';
import mysql from 'mysql2/promise';

const file = process.argv[2];
if (!file) {
    console.error('usage: npm run db:migrate -- <file.sql>');
    process.exit(1);
}

function split(sql) {
    const out = [];
    let delim = ';';
    let buf = '';
    for (const line of sql.split(/\r?\n/)) {
        const m = line.match(/^\s*DELIMITER\s+(\S+)\s*$/i);
        if (m) {
            delim = m[1];
            continue;
        }
        buf += `${line}\n`;
        if (line.trimEnd().endsWith(delim)) {
            const stmt = buf.trimEnd().slice(0, -delim.length).trim();
            if (stmt.replace(/--[^\n]*/g, '').trim()) out.push(stmt);
            buf = '';
        }
    }
    if (buf.replace(/--[^\n]*/g, '').trim()) out.push(buf.trim());
    return out;
}

const conn = await mysql.createConnection({
    host: process.env.DB_HOST || '127.0.0.1',
    port: Number(process.env.DB_PORT || 3306),
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'parivar',
    charset: 'utf8mb4_unicode_ci',
});
const statements = split(await readFile(file, 'utf8'));
for (const [i, stmt] of statements.entries()) {
    await conn.query(stmt);
    console.log(`${i + 1}/${statements.length} ok  ${stmt.split('\n').find((l) => l.trim() && !l.trim().startsWith('--'))?.trim().slice(0, 70)}`);
}
await conn.end();
