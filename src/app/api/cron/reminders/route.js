import { timingSafeEqual } from 'node:crypto';
import { NextResponse } from 'next/server';
import { processDueReminders } from '@/lib/reminders';

// Backup trigger for meeting reminders, for a host cron job every minute:
//   curl -s "https://<site>/api/cron/reminders?key=$CRON_SECRET"
// The in-process loop (src/instrumentation.js) normally does this; both are safe together.
export async function GET(request) {
    const secret = process.env.CRON_SECRET || '';
    const given = request.nextUrl.searchParams.get('key') || request.headers.get('x-cron-key') || '';
    const ok = secret && given.length === secret.length && timingSafeEqual(Buffer.from(given), Buffer.from(secret));
    if (!ok) return NextResponse.json({ error: 'forbidden' }, { status: 403 });
    return NextResponse.json(await processDueReminders());
}
