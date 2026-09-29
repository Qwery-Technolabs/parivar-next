import { NextResponse } from 'next/server';

// Optimistic checks only (cookie PRESENCE). The real session check reads the database
// in the (app) layout and in every server action — a forged cookie gets past here and
// nowhere else.

const LANG_COOKIE = 'lang';
const SESSION_COOKIE = 'pv_session';

export function proxy(request) {
    const { pathname, search } = request.nextUrl;

    // Public fundraise pages are for people with no account and no language cookie.
    if (pathname.startsWith('/p/')) return NextResponse.next();

    const hasLang = request.cookies.has(LANG_COOKIE);
    const hasSession = request.cookies.has(SESSION_COOKIE);

    if (!hasLang && pathname !== '/language') {
        const url = new URL('/language', request.url);
        url.searchParams.set('next', pathname + search);
        return NextResponse.redirect(url);
    }

    if (pathname === '/language' || pathname === '/login') return NextResponse.next();

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
