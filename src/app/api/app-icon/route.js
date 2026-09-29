import { NextResponse } from 'next/server';
import { ICON_SIZES, readAppIcon } from '@/lib/app-icons';

// The Samaj logo as favicon / app icon (?size=32|192|512). Public: the browser fetches it
// before anyone signs in. No saved logo yet → the built-in favicon.
export async function GET(request) {
    const size = Number(new URL(request.url).searchParams.get('size')) || 192;
    const png = ICON_SIZES.includes(size) ? await readAppIcon(size) : null;
    if (!png) return NextResponse.redirect(new URL('/favicon.ico', request.url));
    return new NextResponse(png, {
        headers: {
            'Content-Type': 'image/png',
            // The URL carries ?v=<version>, so a changed logo is a new URL; cache freely.
            'Cache-Control': 'public, max-age=31536000, immutable',
        },
    });
}
