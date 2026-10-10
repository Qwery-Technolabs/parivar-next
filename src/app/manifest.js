import { getSettings } from '@/lib/settings';
import { themeColor } from '@/lib/theme-color';

// Built once and cached (Vercel serves it from the cache — no function run, no database read),
// even though the browser asks for it on every page load. Refreshed hourly and right after
// Settings → General is saved (revalidatePath('/manifest.webmanifest') in actions/settings.js).
export const revalidate = 3600;

// Web app manifest: the Samaj name and its logo as the home-screen app icon.
export default async function manifest() {
    let general = {};
    try {
        general = await getSettings('admin');
    } catch {
        // No database at build time: fall back to the defaults below until the next refresh.
    }
    const name = general.samaj_name || 'Parivar';
    const v = general.logo_version ? `&v=${general.logo_version}` : '';
    // The site's own address (Vercel sets it at build): lets /install ask Android "is this app installed?"
    // (navigator.getInstalledRelatedApps). Without it that check is simply skipped.
    const host = process.env.VERCEL_PROJECT_PRODUCTION_URL || process.env.NEXT_PUBLIC_SITE_HOST || '';
    return {
        id: '/',
        name,
        short_name: name.slice(0, 12).trim(),
        start_url: '/',
        scope: '/',
        display: 'standalone',
        // A link opened while the app is running reuses its window instead of opening another one.
        launch_handler: { client_mode: 'navigate-existing' },
        ...(host ? { related_applications: [{ platform: 'webapp', url: `https://${host}/manifest.webmanifest` }] } : {}),
        background_color: '#ffffff',
        theme_color: await themeColor(), // brand navy, like the browser bar
        icons: [
            { src: `/api/app-icon?size=192${v}`, sizes: '192x192', type: 'image/png', purpose: 'any' },
            { src: `/api/app-icon?size=512${v}`, sizes: '512x512', type: 'image/png', purpose: 'any' },
        ],
    };
}
