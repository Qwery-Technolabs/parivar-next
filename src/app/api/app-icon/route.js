import { NextResponse } from 'next/server';
import { ICON_SIZES, readAppIcon } from '@/lib/app-icons';

const WEEK = 60 * 60 * 24 * 7;

// The Samaj logo as favicon / app icon (?size=32|192|512). Public: the browser fetches it
// before anyone signs in. No saved logo yet → the built-in favicon.
// Caching: a URL with ?v=<logo_version> never changes (a new logo = a new URL) → a year, immutable;
// an unversioned one (push notifications, old installs) and the fallback → 7 days.
export async function GET(request) {
    const params = new URL(request.url).searchParams;
    const size = Number(params.get('size')) || 192;
    const png = ICON_SIZES.includes(size) ? await readAppIcon(size) : null;
    if (!png) {
        const res = NextResponse.redirect(new URL('/favicon.ico', request.url));
        res.headers.set('Cache-Control', `public, max-age=${WEEK}`);
        return res;
    }
    return new NextResponse(png, {
        headers: {
            'Content-Type': 'image/png',
            'Cache-Control': params.get('v') ? 'public, max-age=31536000, immutable' : `public, max-age=${WEEK}, stale-while-revalidate=86400`,
        },
    });
}
