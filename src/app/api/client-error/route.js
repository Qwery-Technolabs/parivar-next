import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// The app's error screen reports what broke here, so it shows up in the server log (Vercel → Logs) as
// "[client error] …" with who and where — a crash in someone's browser is otherwise invisible to us.
// Text only, trimmed; nothing is stored.
export async function POST(request) {
    let body = {};
    try {
        body = await request.json();
    } catch {
        return NextResponse.json({ ok: false }, { status: 400 });
    }
    const user = await getCurrentUser().catch(() => null);
    const clip = (v, n) => String(v ?? '').replace(/\s+/g, ' ').slice(0, n);
    console.error(
        `[client error] user=${user?.id ?? '-'} path=${clip(body.path, 200)} digest=${clip(body.digest, 40)} message=${clip(body.message, 500)} stack=${clip(body.stack, 800)}`,
    );
    return NextResponse.json({ ok: true });
}
