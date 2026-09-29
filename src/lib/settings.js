import 'server-only';
import { cache } from 'react';
import { query } from './db';
import { DEFAULT_TIMEZONE, setAppTimeZone, TIMEZONES } from './timezone';

/**
 * Module settings — key/value rows in `<mod>_settings` (admin_settings for app-wide).
 * The registry below is the ONE definition of which settings exist, their type and default;
 * a key not listed here is never read or written, so the settings page and the code that
 * reads a setting cannot drift apart.
 *
 * type: 'bool' | 'text' | 'number' | 'list' (list = array of strings, edited one per line)
 */
export const SETTINGS = {
    admin: {
        table: 'admin_settings',
        keys: {
            samaj_name: { type: 'text', default: '' }, // shown beside the app name when set
            samaj_name_local: { type: 'text', default: '' },
            contact_phone: { type: 'text', default: '' },
            allow_registration: { type: 'bool', default: false }, // "Create an account" link on the login page
            registration_approval: { type: 'bool', default: true }, // new sign-ups wait (inactive) until an admin activates them
            default_language: { type: 'text', default: 'gu', options: ['gu', 'en'] },
            local_language: { type: 'text', default: 'gu', options: ['gu', 'hi', 'mr'] }, // script for names, per person overridable
            // One timezone for the whole project: "today", meeting reminders, DB clock (lib/timezone.js).
            timezone: { type: 'text', default: DEFAULT_TIMEZONE, options: Object.keys(TIMEZONES), labels: TIMEZONES },
        },
    },
    fundraise: {
        table: 'fundraise_settings',
        keys: {
            default_public: { type: 'bool', default: false }, // new fundraises start with a public link
            allow_anonymous: { type: 'bool', default: true }, // contributors may hide their name publicly
            expense_categories: { type: 'list', default: ['Material', 'Labour', 'Food', 'Transport', 'Printing', 'Other'] },
        },
    },
    blood: {
        table: 'blood_settings',
        keys: {
            notify_donors: { type: 'bool', default: true }, // notify compatible donors on a new requirement
        },
    },
    events: {
        table: 'events_settings',
        keys: {
            notify_new_event: { type: 'bool', default: true },
        },
    },
};

function decode(def, raw) {
    if (raw == null) return def.default;
    try {
        const v = JSON.parse(raw);
        if (def.type === 'bool') return Boolean(v);
        if (def.type === 'number') return Number.isFinite(Number(v)) ? Number(v) : def.default;
        if (def.type === 'list') return Array.isArray(v) ? v.map(String) : def.default;
        return String(v ?? '');
    } catch {
        return def.default;
    }
}

/** All settings of one mod, defaults filled in. Cached per request. */
export const getSettings = cache(async (mod) => {
    const spec = SETTINGS[mod];
    if (!spec) throw new Error(`Unknown settings module ${mod}`);
    const rows = await query(`SELECT setting_key, setting_value FROM ${spec.table}`);
    const stored = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
    const values = Object.fromEntries(Object.entries(spec.keys).map(([k, def]) => [k, decode(def, stored[k])]));
    // Keep the process-wide timezone in step with what the admin chose.
    if (mod === 'admin') setAppTimeZone(values.timezone);
    return values;
});

export async function getSetting(mod, key) {
    return (await getSettings(mod))[key];
}

/**
 * Coerce a submitted value to the setting's type, clamped. Returns undefined for an
 * unknown key so a forged field name is ignored rather than stored.
 */
export function coerceSetting(mod, key, raw) {
    const def = SETTINGS[mod]?.keys[key];
    if (!def) return undefined;
    if (def.type === 'bool') return raw === '1' || raw === 'on' || raw === true;
    if (def.type === 'number') {
        const n = Number(raw);
        if (!Number.isFinite(n)) return def.default;
        return Math.min(def.max ?? Infinity, Math.max(def.min ?? -Infinity, Math.round(n)));
    }
    if (def.type === 'list') {
        return [...new Set(String(raw ?? '').split(/\r?\n/).map((s) => s.trim()).filter(Boolean))].slice(0, 50);
    }
    const s = String(raw ?? '').trim().slice(0, 500);
    return def.options && !def.options.includes(s) ? def.default : s;
}

/** @param {Record<string, unknown>} values already coerced */
export async function saveSettings(mod, values, q = query) {
    const spec = SETTINGS[mod];
    for (const [key, value] of Object.entries(values)) {
        if (!spec.keys[key] || value === undefined) continue;
        await q(
            `INSERT INTO ${spec.table} (setting_key, setting_value) VALUES (:key, :value)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            { key, value: JSON.stringify(value) },
        );
    }
}
