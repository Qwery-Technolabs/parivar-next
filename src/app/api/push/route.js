import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getCurrentUser, PUSH_COOKIE } from '@/lib/auth';
import { query } from '@/lib/db';
import { endpointHash, pushToUsers } from '@/lib/push';

/**
 * Save this browser's push subscription for the signed-in member. A token belongs to ONE person: saved by someone
 * else on the same browser it moves to them (dates start again); one person may have many (each device).
 */
export async function POST(request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const endpoint = String(body?.endpoint ?? '');
    const p256dh = String(body?.keys?.p256dh ?? '');
    const auth = String(body?.keys?.auth ?? '');
    if (!/^https:\/\//.test(endpoint) || endpoint.length > 1000 || !p256dh || !auth || p256dh.length > 255 || auth.length > 255) {
        return NextResponse.json({ error: 'invalid subscription' }, { status: 400 });
    }
    await query(
        `INSERT INTO users_push_subscriptions (user_id, endpoint_hash, endpoint, p256dh, auth, user_agent)
         VALUES (:uid, :h, :endpoint, :p256dh, :auth, :ua)
         ON DUPLICATE KEY UPDATE
             created_at = IF(user_id = VALUES(user_id), created_at, NOW()),
             last_used_at = IF(user_id = VALUES(user_id), last_used_at, NULL),
             user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent)`,
        {
            uid: user.id,
            h: endpointHash(endpoint),
            endpoint,
            p256dh,
            auth,
            ua: request.headers.get('user-agent')?.slice(0, 255) ?? null,
        },
    );
    (await cookies()).set(PUSH_COOKIE, endpointHash(endpoint), {
        httpOnly: true,
        sameSite: 'lax',
        secure: process.env.NODE_ENV === 'production',
        path: '/',
        maxAge: 400 * 24 * 60 * 60,
    });
    if (body?.test) await pushToUsers([user.id], { type: 'push.test', data: {}, link: '/settings?section=notifications' });
    return NextResponse.json({ ok: true });
}

/** Forget this browser (the member turned notifications off here). Only their own row. */
export async function DELETE(request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });
    const body = await request.json().catch(() => null);
    const endpoint = String(body?.endpoint ?? '');
    if (endpoint) {
        await query('DELETE FROM users_push_subscriptions WHERE endpoint_hash = :h AND user_id = :uid', {
            h: endpointHash(endpoint),
            uid: user.id,
        });
    }
    (await cookies()).delete(PUSH_COOKIE);
    return NextResponse.json({ ok: true });
}
