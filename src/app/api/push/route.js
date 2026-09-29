import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { endpointHash, pushToUsers } from '@/lib/push';

/** Save this browser's push subscription for the signed-in member (re-subscribing just updates it). */
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
         ON DUPLICATE KEY UPDATE user_id = VALUES(user_id), p256dh = VALUES(p256dh), auth = VALUES(auth), user_agent = VALUES(user_agent)`,
        {
            uid: user.id,
            h: endpointHash(endpoint),
            endpoint,
            p256dh,
            auth,
            ua: request.headers.get('user-agent')?.slice(0, 255) ?? null,
        },
    );
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
    return NextResponse.json({ ok: true });
}
