import 'server-only';
import mysql from 'mysql2/promise';

// DESIGN.md §9 — one cached pool, named placeholders, bounded prepared-statement cache.

const POOL_SIZE = Number(process.env.DB_POOL_SIZE || 10);
// MySQL's server-wide max_prepared_stmt_count defaults to 16382 and is shared with every
// other app on the server. Budget half of it, split across our connections, floor 32 —
// the driver default (16000 per connection) never evicts and exhausts the server.
const STMT_BUDGET = 8000;
const MAX_PREPARED = Math.max(32, Math.floor(STMT_BUDGET / POOL_SIZE));

function createPool() {
    return mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'parivar',
        connectionLimit: POOL_SIZE,
        namedPlaceholders: true,
        maxPreparedStatements: MAX_PREPARED,
        charset: 'utf8mb4_unicode_ci',
        timezone: '+05:30',
        dateStrings: true, // DATE stays 'YYYY-MM-DD'; no UTC shift turning the 5th into the 4th
        decimalNumbers: true,
    });
}

// A module-level pool without the globalThis cache leaks a pool per hot reload in dev.
const pool = globalThis.__parivarPool ?? createPool();
if (!pool.__tzHooked) {
    // The hosting server's clock is UTC (@@system_time_zone). Without this, NOW() and every
    // DEFAULT CURRENT_TIMESTAMP record UTC, and chat/notification/audit times read 5h30m
    // early to people in India. The `timezone` pool option only converts JS Dates; it does
    // not change what the server's own clock functions return.
    // Strict mode too: the host runs MariaDB without STRICT_TRANS_TABLES, where a bad enum
    // value is silently stored as '' and overlong text is cut off. Refusing is better than
    // quietly storing something else.
    pool.pool.on('connection', (conn) =>
        conn.query(
            "SET time_zone = '+05:30', sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION'",
        ),
    );
    pool.__tzHooked = true;
}
if (process.env.NODE_ENV !== 'production') globalThis.__parivarPool = pool;

const LOCK_ERRORS = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);
const DEAD_CONN = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST']);

/** Conservative: anything not clearly a plain SELECT is treated as a write. */
function isReadOnly(sql) {
    const s = sql.replace(/^\s*(\/\*[\s\S]*?\*\/\s*|--[^\n]*\n\s*)*/, '').trimStart();
    if (!/^(select|show|with)\b/i.test(s)) return false;
    return !/\b(insert|update|delete|replace|into)\b/i.test(s);
}

/**
 * Run one statement on the pool.
 * @param {string} sql
 * @param {Record<string, unknown>} [params]
 */
export async function query(sql, params = {}) {
    for (let attempt = 0; ; attempt++) {
        try {
            const [rows] = await pool.execute(sql, params);
            return rows;
        } catch (err) {
            const retryable =
                LOCK_ERRORS.has(err.code) ||
                // A reset can arrive after the server committed — replaying a write double-inserts.
                (DEAD_CONN.has(err.code) && isReadOnly(sql));
            if (!retryable || attempt >= 2) throw err;
            await new Promise((r) => setTimeout(r, 50 * (attempt + 1)));
        }
    }
}

/** First row or null. */
export async function queryOne(sql, params = {}) {
    const rows = await query(sql, params);
    return rows[0] ?? null;
}

/**
 * Pin one connection for atomic work. Use the `q` passed in — the module-level
 * `query` inside the callback runs OUTSIDE the transaction. Never retried: a replay double-writes.
 * @template T
 * @param {(q: (sql: string, params?: object) => Promise<any>) => Promise<T>} run
 * @returns {Promise<T>}
 */
export async function withTransaction(run) {
    const conn = await pool.getConnection();
    try {
        await conn.beginTransaction();
        const q = async (sql, params = {}) => (await conn.execute(sql, params))[0];
        const out = await run(q);
        await conn.commit();
        return out;
    } catch (err) {
        await conn.rollback().catch(() => {});
        throw err;
    } finally {
        conn.release();
    }
}

/**
 * Named placeholders for an IN list, so the SQL text varies only by the COUNT of ids —
 * interpolating the ids makes a new prepared statement per distinct list.
 * @param {Array<string|number>} values
 * @param {string} [prefix]
 * @returns {{ sql: string, params: Record<string, string|number> }}
 */
export function inList(values, prefix = 'in') {
    const params = {};
    const names = values.map((v, i) => {
        params[`${prefix}${i}`] = v;
        return `:${prefix}${i}`;
    });
    return { sql: names.length ? names.join(', ') : 'NULL', params };
}

// ── meta tables: <table>meta(meta_id, <fk>, meta_key, meta_value) ─────────────

const META = {
    users_list: ['users_listmeta', 'user_id'],
    admin_groups: ['admin_groupsmeta', 'group_id'],
    blood_requests: ['blood_requestsmeta', 'request_id'],
    fundraise_campaigns: ['fundraise_campaignsmeta', 'campaign_id'],
    fundraise_expenses: ['fundraise_expensesmeta', 'expense_id'],
    fundraise_updates: ['fundraise_updatesmeta', 'update_id'],
    events_list: ['events_listmeta', 'event_id'],
    chat_messages: ['chat_messagesmeta', 'message_id'],
};

function metaTable(base) {
    const m = META[base];
    if (!m) throw new Error(`No meta table for ${base}`);
    return m;
}

/** @returns {Promise<Record<string, string>>} */
export async function getMeta(base, id) {
    const [table, fk] = metaTable(base);
    const rows = await query(`SELECT meta_key, meta_value FROM ${table} WHERE ${fk} = :id`, { id });
    return Object.fromEntries(rows.map((r) => [r.meta_key, r.meta_value ?? '']));
}

/** Meta for many parents at once: { [id]: { key: value } }. */
export async function getMetaMany(base, ids, keys) {
    if (!ids.length) return {};
    const [table, fk] = metaTable(base);
    const idList = inList(ids, 'id');
    const keyList = inList(keys, 'k');
    const rows = await query(
        `SELECT ${fk} AS pid, meta_key, meta_value FROM ${table}
          WHERE ${fk} IN (${idList.sql}) AND meta_key IN (${keyList.sql})`,
        { ...idList.params, ...keyList.params },
    );
    const out = {};
    for (const r of rows) (out[r.pid] ??= {})[r.meta_key] = r.meta_value ?? '';
    return out;
}

/**
 * Upsert meta; an empty value deletes the key so absent and blank are one state.
 * @param {string} base
 * @param {number} id
 * @param {Record<string, string|null|undefined>} values
 * @param {(sql: string, params?: object) => Promise<any>} [q] pass the transaction's q
 */
export async function setMeta(base, id, values, q = query) {
    const [table, fk] = metaTable(base);
    for (const [key, raw] of Object.entries(values)) {
        const value = raw == null ? '' : String(raw).trim();
        if (value === '') {
            await q(`DELETE FROM ${table} WHERE ${fk} = :id AND meta_key = :key`, { id, key });
        } else {
            await q(
                `INSERT INTO ${table} (${fk}, meta_key, meta_value) VALUES (:id, :key, :value)
                 ON DUPLICATE KEY UPDATE meta_value = VALUES(meta_value)`,
                { id, key, value },
            );
        }
    }
}
