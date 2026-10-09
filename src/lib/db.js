import 'server-only';
import mysql from 'mysql2/promise';
import { offsetOf } from './timezone';

// design-system.md §9 — one cached pool, named placeholders, plain (client-escaped) queries.

// A small pool, kept open. The host (Hostinger shared) allows only 500 NEW connections per hour
// per database user (max_connections_per_hour) and caps open connections per user; every
// serverless instance / build worker has its own pool. So never a big pool (100 would blow both).
// 5 per instance: a page's parallel queries (Promise.all of 5–8) run together instead of queueing
// behind 2, which made pages slow. The host also caps OPEN connections at 50 per user (max_user_connections)
// across every instance, so 5 × ≤10 instances. Never 1 (a helper calling the pool inside a transaction
// would wait forever). DB_POOL_SIZE overrides.
const POOL_SIZE = Number(process.env.DB_POOL_SIZE || 5);
// The server closes a connection idle for wait_timeout = 20 s (Hostinger's global value). Each of ours
// asks for SESSION_WAIT_S instead, so a pause of a minute does not mean reconnecting (≈ 4 round trips
// each, and one more against the hourly new-connection limit). The pool closes idle ones itself a bit
// sooner (IDLE_MS), and a connection idle longer than that is never used (a frozen serverless instance
// cannot run the pool's timer — the server may already have dropped it): see `connection()`.
const SESSION_WAIT_S = 120;
const IDLE_MS = 100 * 1000;
// A statement slower than this is logged (Vercel logs) with its first words — to find slow pages.
const SLOW_MS = 800;
// Plain queries, not prepared statements: mysql2 escapes the values (named placeholders, same safety;
// sql_mode below has no NO_BACKSLASH_ESCAPES). A prepared statement costs an extra round trip the
// first time each connection meets that SQL — on this remote database that doubled every query after a
// cold start (new instance = new connections), which is why pages were slow to open the first time.
// It also no longer uses up the server-wide max_prepared_stmt_count shared with other apps.

function createPool(offset) {
    const pool = mysql.createPool({
        host: process.env.DB_HOST || '127.0.0.1',
        port: Number(process.env.DB_PORT || 3306),
        user: process.env.DB_USER || 'root',
        password: process.env.DB_PASSWORD || '',
        database: process.env.DB_NAME || 'parivar',
        connectionLimit: POOL_SIZE,
        // Busy pool: wait for a free connection (no error), with no cap on the wait queue.
        waitForConnections: true,
        queueLimit: 0,
        // A healthy connect takes ~0.2 s; a stuck one is given up after 5 s and tried again (connection()).
        connectTimeout: 5 * 1000,
        // At most 3 idle connections kept per instance (maxIdle must be below the limit, or mysql2 never
        // closes idle ones), each for IDLE_MS — open slots are shared by every instance (cap 50) and every
        // reconnect counts against the hourly limit. TCP keep-alive stops routers dropping them.
        maxIdle: Math.min(3, POOL_SIZE - 1),
        idleTimeout: IDLE_MS,
        enableKeepAlive: true,
        keepAliveInitialDelay: 30 * 1000,
        namedPlaceholders: true,
        charset: 'utf8mb4_unicode_ci',
        timezone: offset,
        dateStrings: true, // DATE stays 'YYYY-MM-DD'; no UTC shift turning the 5th into the 4th
        decimalNumbers: true,
    });
    // The hosting server's clock is UTC (@@system_time_zone). Without this, NOW() and every
    // DEFAULT CURRENT_TIMESTAMP record UTC, and chat/notification/audit times read hours
    // off for members. The `timezone` pool option only converts JS Dates; it does not change
    // what the server's own clock functions return. The offset is the project timezone
    // (admin setting, default IST — lib/timezone.js).
    // Strict mode too: the host runs MariaDB without STRICT_TRANS_TABLES, where a bad enum
    // value is silently stored as '' and overlong text is cut off. Refusing is better than
    // quietly storing something else.
    pool.pool.on('connection', (conn) =>
        conn.query(
            `SET time_zone = '${offset}', sql_mode = 'STRICT_TRANS_TABLES,ERROR_FOR_DIVISION_BY_ZERO,NO_ENGINE_SUBSTITUTION', SESSION wait_timeout = ${SESSION_WAIT_S}`,
        ),
    );
    return pool;
}

/**
 * The pool for the project timezone's current offset. When an admin changes the timezone
 * (or DST moves the offset) a fresh pool is built, so every connection agrees; the old one
 * drains and closes. Cached on globalThis — a module-level pool leaks one per dev reload.
 */
function currentPool() {
    const offset = offsetOf();
    const state = (globalThis.__parivarDb ??= { pool: null, offset: null });
    if (state.offset !== offset) {
        const old = state.pool;
        state.pool = createPool(offset);
        state.offset = offset;
        if (old) setTimeout(() => old.end().catch(() => {}), 30000);
    }
    return state.pool;
}

const LOCK_ERRORS = new Set(['ER_LOCK_DEADLOCK', 'ER_LOCK_WAIT_TIMEOUT']);
const DEAD_CONN = new Set(['ECONNRESET', 'EPIPE', 'ETIMEDOUT', 'PROTOCOL_CONNECTION_LOST']);
const CONNECT_ERRORS = new Set(['ETIMEDOUT', 'ECONNREFUSED', 'ECONNRESET', 'EHOSTUNREACH', 'ENETUNREACH', 'EAI_AGAIN', 'PROTOCOL_CONNECTION_LOST']);

/** Conservative: anything not clearly a plain SELECT is treated as a write. */
function isReadOnly(sql) {
    const s = sql.replace(/^\s*(\/\*[\s\S]*?\*\/\s*|--[^\n]*\n\s*)*/, '').trimStart();
    if (!/^(select|show|with)\b/i.test(s)) return false;
    return !/\b(insert|update|delete|replace|into)\b/i.test(s);
}

/**
 * Plain values only (as prepared statements required): a plain query would quietly turn an object into
 * `a` = 1, `b` = 2 and an array into a list — fail loudly instead.
 */
function checkParams(sql, params) {
    for (const v of Array.isArray(params) ? params : Object.values(params ?? {})) {
        if (v !== null && typeof v === 'object' && !(v instanceof Date) && !Buffer.isBuffer(v)) {
            throw new TypeError(`db: a query value must be plain (string, number, boolean, null, Date) — ${sql.replace(/\s+/g, ' ').trim().slice(0, 80)}`);
        }
    }
}

/**
 * A pooled connection that is safe to use: one idle longer than IDLE_MS is dropped instead (the server
 * may have closed it while this instance was frozen) — so a write never goes out on a dead connection.
 */
async function connection() {
    for (let attempt = 0; ; attempt++) {
        let conn;
        try {
            conn = await currentPool().getConnection();
        } catch (err) {
            // Opening a connection failed (a network blip between Vercel and the host: connect ETIMEDOUT,
            // refused, reset). Nothing was sent yet, so trying again is safe — for writes too.
            if (!CONNECT_ERRORS.has(err.code) || attempt >= 2) throw err;
            console.warn(`[db] connect ${err.code}, retrying (${attempt + 1})`);
            await new Promise((r) => setTimeout(r, 300 * (attempt + 1)));
            continue;
        }
        if (Date.now() - (conn.connection.lastActiveTime ?? Date.now()) < IDLE_MS) return conn;
        conn.destroy();
    }
}

/**
 * Run one statement on the pool.
 * @param {string} sql
 * @param {Record<string, unknown>} [params]
 */
export async function query(sql, params = {}) {
    checkParams(sql, params);
    for (let attempt = 0; ; attempt++) {
        try {
            const started = Date.now();
            const conn = await connection();
            let rows;
            try {
                [rows] = await conn.query(sql, params);
            } finally {
                conn.release();
            }
            const ms = Date.now() - started;
            // Includes the wait for a free connection — a long one means the pool is too small or a query is heavy.
            if (ms > SLOW_MS) console.warn(`[db slow] ${ms} ms: ${sql.replace(/\s+/g, ' ').trim().slice(0, 120)}`);
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
    const conn = await connection();
    try {
        await conn.beginTransaction();
        const q = async (sql, params = {}) => {
            checkParams(sql, params);
            return (await conn.query(sql, params))[0];
        };
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
 * the SQL text stays short and the same for lists of the same length.
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
