// Local throwaway MySQL 8 for development/testing only (data is lost on exit).
// Production uses a real MySQL server configured through .env.local.
import { createDB } from 'mysql-memory-server';

const db = await createDB({ version: '8.4.x', dbName: 'parivar', port: Number(process.env.DEV_DB_PORT || 3307), xEnabled: 'OFF', logLevel: 'WARN' });
console.log(`MySQL ready on 127.0.0.1:${db.port} db=${db.dbName} user=${db.username}`);
process.on('SIGINT', async () => { await db.stop(); process.exit(0); });
setInterval(() => {}, 1 << 30);
