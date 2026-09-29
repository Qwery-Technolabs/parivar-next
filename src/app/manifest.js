import { connection } from 'next/server';
import { getSettings } from '@/lib/settings';
import { themeColor } from '@/lib/theme-color';

// Web app manifest: the Samaj name and its logo as the home-screen app icon.
export default async function manifest() {
    // Per request, not frozen at build: the Samaj name and logo change from Settings → General.
    await connection();
    let general = {};
    try {
        general = await getSettings('admin');
    } catch {
        // No database at build time: fall back to the defaults below.
    }
    const name = general.samaj_name || 'Parivar';
    const v = general.logo_version ? `&v=${general.logo_version}` : '';
    return {
        name,
        short_name: name.slice(0, 12).trim(),
        start_url: '/',
        display: 'standalone',
        background_color: '#ffffff',
        theme_color: await themeColor(), // the Samaj logo's background, like the browser bar
        icons: [
            { src: `/api/app-icon?size=192${v}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `/api/app-icon?size=512${v}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
    };
}
