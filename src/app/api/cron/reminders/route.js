import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processDueReminders } from '@/lib/reminders';

// Trigger for meeting reminders from a scheduler:
//   - Vercel Cron (vercel.json) calls it with "Authorization: Bearer $CRON_SECRET";
//   - any other host: curl -s "https://<site>/api/cron/reminders?key=$CRON_SECRET" every minute.
// On a long-running server the in-process loop (src/instrumentation.js) does this too; both are safe together.
export async function GET(request) {
    const secret = process.env.CRON_SECRET || '';
    const bearer = (request.headers.get('authorization') || '').replace(/^Bearer\s+/i, '');
    const given = bearer || request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key') || '';
    const ok = secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
    if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    return NextResponse.json(await processDueReminders());
}
