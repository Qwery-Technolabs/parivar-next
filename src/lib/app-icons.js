import 'server-only';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';

// The Samaj logo as the favicon / app icon: PNGs drawn in the browser on save (lib/app-icon-canvas.js),
// stored in public/app-icons/. Served through /api/app-icon (not straight from public/): Next.js
// only serves public/ files that existed at build time, and these are written later.

export const ICON_SIZES = [512, 192, 32];
const DIR = path.join(process.cwd(), 'public', 'app-icons');
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const MAX_BYTES = 300 * 1024;

const fileFor = (size) => path.join(DIR, `icon-${size}.png`);

/** Decode and check a PNG data URL; null when it is not a small, real PNG. */
function decodePng(dataUrl) {
    const m = /^data:image\/png;base64,([A-Za-z0-9+/=]+)$/.exec(String(dataUrl ?? ''));
    if (!m) return null;
    const buf = Buffer.from(m[1], 'base64');
    if (buf.length > MAX_BYTES || !buf.subarray(0, 8).equals(PNG_MAGIC)) return null;
    return buf;
}

/**
 * Write the three sizes. All or nothing: any bad image and nothing is written.
 * @param {Record<number, string>} dataUrls
 * @returns {Promise<boolean>}
 */
export async function writeAppIcons(dataUrls) {
    const bufs = ICON_SIZES.map((s) => decodePng(dataUrls[s]));
    if (bufs.some((b) => !b)) return false;
    await mkdir(DIR, { recursive: true });
    await Promise.all(ICON_SIZES.map((s, i) => writeFile(fileFor(s), bufs[i])));
    return true;
}

/** The stored PNG for a size, or null when none has been saved yet. */
export async function readAppIcon(size) {
    if (!ICON_SIZES.includes(size)) return null;
    try {
        return await readFile(fileFor(size));
    } catch {
        return null;
    }
}
