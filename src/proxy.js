import { NextResponse } from 'next/server';

// Optimistic checks only (cookie PRESENCE). The real session check reads the database
// in the (app) layout and in every server action — a forged cookie gets past here and
// nowhere else.

const SESSION_COOKIE = 'pv_session';

export function proxy(request) {
    const { pathname, search } = request.nextUrl;

    // Public fundraise pages are for people with no account and no language cookie.
    if (pathname.startsWith('/p/')) return NextResponse.next();

    const hasSession = request.cookies.has(SESSION_COOKIE);
    // No language redirect: without a cookie the app uses the admin's default language
    // (Settings → General); /language stays available to switch.

    // The privacy policy (linked from Settings → About) and the install page (a link to share) are public.
    if (['/language', '/login', '/register', '/privacy-policy', '/install'].includes(pathname)) return NextResponse.next();

    if (!hasSession) {
        const url = new URL('/login', request.url);
        if (pathname !== '/') url.searchParams.set('next', pathname + search);
        return NextResponse.redirect(url);
    }
    return NextResponse.next();
}

export const config = {
    // Everything except Next internals, API routes and files with an extension.
    matcher: ['/((?!_next/|api/|favicon.ico|.*\\.[a-zA-Z0-9]+$).*)'],
};
