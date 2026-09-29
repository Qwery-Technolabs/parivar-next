// Pure module — FormData parsing for server actions. Validate at the edge, clamp rather than trust.

/** Trimmed string, capped; '' when absent. */
export function str(fd, key, max = 255) {
    return String(fd.get(key) ?? '').trim().slice(0, max);
}

/** Trimmed string or null when blank. */
export function strOrNull(fd, key, max = 255) {
    return str(fd, key, max) || null;
}

/** Positive integer id or null. */
export function id(fd, key) {
    const n = Number.parseInt(String(fd.get(key) ?? ''), 10);
    return Number.isInteger(n) && n > 0 ? n : null;
}

/** Hidden-input boolean from Switch ('1'/'0') or checkbox ('on'). */
export function bool(fd, key) {
    const v = fd.get(key);
    return v === '1' || v === 'on' || v === 'true';
}

/** Money: up to 2 decimals, 0 < x < 1e10. Returns null when invalid. Accepts "1,00,000". */
export function money(fd, key) {
    const raw = String(fd.get(key) ?? '').replace(/[,\s₹]/g, '');
    if (!/^\d+(\.\d{1,2})?$/.test(raw)) return null;
    const n = Number(raw);
    return n > 0 && n < 1e10 ? n : null;
}

/** 'YYYY-MM-DD' that is a real calendar date, else null. */
export function date(fd, key) {
    const v = String(fd.get(key) ?? '').trim();
    if (!/^\d{4}-\d{2}-\d{2}$/.test(v)) return null;
    const d = new Date(`${v}T00:00:00Z`);
    return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === v ? v : null;
}

/** 'HH:MM' → 'HH:MM:00', else null. */
export function time(fd, key) {
    const v = String(fd.get(key) ?? '').trim();
    return /^([01]\d|2[0-3]):[0-5]\d$/.test(v) ? `${v}:00` : null;
}

/** Value from an allow-list, else the fallback. */
export function oneOf(fd, key, allowed, fallback = null) {
    const v = String(fd.get(key) ?? '');
    return allowed.includes(v) ? v : fallback;
}

// Today in the project timezone (admin setting, default IST).
export { todayLocal } from './timezone';
