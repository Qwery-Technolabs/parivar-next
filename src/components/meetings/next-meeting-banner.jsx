import { CalendarClock } from 'lucide-react';
import Link from 'next/link';
import { getCurrentUser } from '@/lib/auth';
import { date, time } from '@/lib/format';
import { todayLocal } from '@/lib/forms';
import { getT } from '@/lib/i18n/server';
import { nextMeetingOf } from '@/lib/meetings';

/** Pinned at the top of a discussion, like a pinned message: the next meeting and your answer. */
export default async function NextMeetingBanner({ scope, scopeId, href }) {
    const user = await getCurrentUser();
    const [{ t, locale }, m] = await Promise.all([getT(), nextMeetingOf(scope, scopeId, user.id, todayLocal())]);
    if (!m) return null;
    const answer = m.my_rsvp ? t(`meetings.rsvp.${m.my_rsvp}`) : null;
    return (
        <Link href={href} className="mb-2 flex items-center gap-2.5 rounded-lg border border-surface-border bg-orange-50 px-3 py-2 text-sm hover:bg-orange-100">
            <CalendarClock className="size-4 shrink-0 text-brand-navy" />
            <span className="min-w-0 flex-1 truncate text-brand-navy">
                <span className="font-semibold">{t('meetings.next')}:</span> {(locale !== 'en' && m.title_local) || m.title} · {date(m.start_date, locale)}
                {m.start_time && ` · ${time(m.start_time)}`}
                {m.location && ` · ${m.location}`}
            </span>
            {answer ? (
                <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-brand-navy">{answer}</span>
            ) : (
                m.attendees.some((a) => a.user_id === user.id) && (
                    <span className="shrink-0 rounded-full bg-white px-2 py-0.5 text-xs font-medium text-brand-navy">{t('meetings.answerNow')}</span>
                )
            )}
        </Link>
    );
}
