import 'server-only';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { query } from './db';

// The Samaj logo as the favicon / app icon: PNGs drawn in the browser on save (lib/app-icon-canvas.js),
// stored base64 in admin_settings (app_icon_<size>), not on disk: serverless hosts (Vercel) have
// no lasting filesystem. getSettings skips these rows. Served through /api/app-icon.

export const ICON_SIZES = [512, 192, 32];
export const ICON_KEY_PREFIX = 'app_icon_';
// Older installs wrote the files here; still read as a fallback until the logo is saved again.
const LEGACY_DIR = path.join(process.cwd(), 'public', 'app-icons');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 300 * 1024;

/** Decode and check a PNG data URL; null when it is not a small, real PNG. */
function decodePng(dataUrl) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ''));
    if (!m) return null;
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > MAX_BYTES || !buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
    return buf;
}

/**
 * Store the three sizes. All or nothing: any bad image and nothing is written.
 * @param {Record<number, string>} dataUrls
 * @param {Function} [q] a transaction's query, when called inside one
 * @returns {Promise<boolean>}
 */
export async function writeAppIcons(dataUrls, q = query) {
    const bufs = ICON_SIZES.map((s) => decodePng(dataUrls[s]));
    if (bufs.some((b) => !b)) return false;
    for (const [i, size] of ICON_SIZES.entries()) {
        await q(
            `INSERT INTO admin_settings (setting_key, setting_value) VALUES (:key, :value)
             ON DUPLICATE KEY UPDATE setting_value = VALUES(setting_value)`,
            { key: `${ICON_KEY_PREFIX}${size}`, value: bufs[i].toString('base64') },
        );
    }
    return true;
}

/** The stored PNG for a size, or null when none has been saved yet. */
export async function readAppIcon(size) {
    if (!ICON_SIZES.includes(size)) return null;
    const [row] = await query('SELECT setting_value FROM admin_settings WHERE setting_key = :key', { key: `${ICON_KEY_PREFIX}${size}` });
    if (row?.setting_value) return Buffer.from(row.setting_value, 'base64');
    try {
        return await readFile(path.join(LEGACY_DIR, `icon-${size}.png`));
    } catch {
        return null;
    }
}
