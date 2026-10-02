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
 * group: the part of the Settings form it sits in (settings.formGroups.<group>, with an icon in SettingsForm)
 */
export const SETTINGS = {
    admin: {
        table: 'admin_settings',
        keys: {
            samaj_name: { type: 'text', default: '', group: 'samaj' }, // shown beside the app name when set
            samaj_name_local: { type: 'text', default: '', group: 'samaj' },
            // Samaj logo (picker in Settings → General; hidden from the generic form).
            logo_kind: { type: 'text', default: '', hidden: true },
            logo_value: { type: 'text', default: '', hidden: true },
            logo_color: { type: 'text', default: '', hidden: true },
            logo_version: { type: 'text', default: '', hidden: true }, // bumps when the favicon / app icon is redrawn
            contact_phone: { type: 'text', default: '', group: 'samaj' },
            allow_registration: { type: 'bool', default: false, group: 'signup' }, // "Create an account" link on the login page
            registration_approval: { type: 'bool', default: true, group: 'signup' }, // new sign-ups wait (inactive) until an admin activates them
            default_language: { type: 'text', default: 'gu', options: ['gu', 'en'], group: 'language' },
            local_language: { type: 'text', default: 'gu', options: ['gu', 'hi'], group: 'language' }, // script for names, per person overridable
            // One timezone for the whole project: "today", meeting reminders, DB clock (lib/timezone.js).
            timezone: { type: 'text', default: DEFAULT_TIMEZONE, options: Object.keys(TIMEZONES), labels: TIMEZONES, group: 'language' },
        },
    },
    fundraise: {
        table: 'fundraise_settings',
        keys: {
            default_public: { type: 'bool', default: false, group: 'sharing' }, // new fundraises start with a public link
            allow_anonymous: { type: 'bool', default: true, group: 'sharing' }, // contributors may hide their name publicly
            expense_categories: { type: 'list', default: ['Material', 'Labour', 'Food', 'Transport', 'Printing', 'Other'], group: 'expenses' },
        },
    },
    blood: {
        table: 'blood_settings',
        keys: {
            notify_donors: { type: 'bool', default: true, hidden: true }, // shown in Settings → Notifications
        },
    },
    events: {
        table: 'events_settings',
        keys: {
            notify_new_event: { type: 'bool', default: true, hidden: true }, // shown in Settings → Notifications
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

// Settings are read on almost every request (layout, titles, theme colour, manifest, loader colour) and
// change rarely: keep them in memory per server instance for a minute, so most requests skip the query
// (on a fresh instance it also paid for opening the DB connection — logged as [db slow] ~1.5 s).
// saveSettings forgets them at once on this instance; other instances catch up within SETTINGS_TTL.
const SETTINGS_TTL = 60 * 1000;
const memo = (globalThis.__parivarSettings ??= new Map()); // mod → { at, values }

/** All settings of one mod, defaults filled in. Cached per request, and in memory for SETTINGS_TTL. */
export const getSettings = cache(async (mod) => {
    const spec = SETTINGS[mod];
    if (!spec) throw new Error(`Unknown settings module ${mod}`);
    const hit = memo.get(mod);
    if (hit && Date.now() - hit.at < SETTINGS_TTL) {
        if (mod === 'admin') setAppTimeZone(hit.values.timezone);
        return hit.values;
    }
    // app_icon_* rows (the favicon PNGs, lib/app-icons.js) are large and read only by /api/app-icon.
    const rows = await query(`SELECT setting_key, setting_value FROM ${spec.table} WHERE setting_key NOT LIKE 'app_icon_%'`);
    const stored = Object.fromEntries(rows.map((r) => [r.setting_key, r.setting_value]));
    const values = Object.fromEntries(Object.entries(spec.keys).map(([k, def]) => [k, decode(def, stored[k])]));
    // Keep the process-wide timezone in step with what the admin chose.
    if (mod === 'admin') setAppTimeZone(values.timezone);
    memo.set(mod, { at: Date.now(), values });
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
    memo.delete(mod); // the next read sees the new values (this instance at once; others within SETTINGS_TTL)
}

/**
 * The name the app goes by: the Samaj name from Settings → General, in the reader's language
 * (local name for gu / hi readers), or '' when none is set — callers fall back to the app name.
 * @param {Record<string, any>} general  getSettings('admin')
 * @param {string} locale
 */
export function samajName(general, locale) {
    return ((locale !== 'en' && general?.samaj_name_local) || general?.samaj_name || '').trim();
}
