'use client';
import { avatarInk } from './group-avatar';

// Browser-only: draw the chosen Samaj logo (icon / emoji / ≤2 letters on its colour) onto a
// canvas and export PNGs for the favicon and app icon. Saved with Settings → General.

const SIZES = [512, 192, 32];

function loadSvg(svg) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(svg)}`;
    });
}

/**
 * @param {{ kind: string, value: string, color: string, iconSvg?: SVGElement|null }} logo
 *   iconSvg: the picker's rendered lucide icon (for kind 'icon')
 * @returns {Promise<Record<string, string>>} { 512: dataURL, 192: dataURL, 32: dataURL }
 */
export async function renderLogoPngs({ kind, value, color, iconSvg }) {
    const bg = color || '#b85d09';
    const ink = avatarInk(bg);
    const big = document.createElement('canvas');
    big.width = big.height = 512;
    const ctx = big.getContext('2d');

    // Rounded square — the same shape as the logo in the app.
    ctx.fillStyle = bg;
    ctx.beginPath();
    ctx.roundRect(0, 0, 512, 512, 96);
    ctx.fill();

    if (kind === 'icon' && iconSvg) {
        const clone = iconSvg.cloneNode(true);
        clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg');
        clone.setAttribute('width', '300');
        clone.setAttribute('height', '300');
        clone.setAttribute('stroke', ink);
        clone.setAttribute('color', ink);
        clone.removeAttribute('class');
        const img = await loadSvg(new XMLSerializer().serializeToString(clone));
        ctx.drawImage(img, 106, 106, 300, 300);
    } else if ((kind === 'emoji' || kind === 'text') && value) {
        ctx.fillStyle = ink;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        const size = kind === 'emoji' ? 300 : Array.from(value).length > 1 ? 230 : 290;
        ctx.font = `600 ${size}px system-ui, "Noto Sans Gujarati", "Noto Sans Devanagari", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
        ctx.fillText(value, 256, kind === 'emoji' ? 276 : 270);
    }

    const out = {};
    for (const size of SIZES) {
        if (size === 512) {
            out[size] = big.toDataURL('image/png');
            continue;
        }
        const c = document.createElement('canvas');
        c.width = c.height = size;
        const x = c.getContext('2d');
        x.imageSmoothingQuality = 'high';
        x.drawImage(big, 0, 0, size, size);
        out[size] = c.toDataURL('image/png');
    }
    return out;
}
