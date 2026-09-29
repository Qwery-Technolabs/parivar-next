import { CalendarX, Clock, MapPin } from 'lucide-react';
import { cancelMeeting } from '@/app/actions/fundraise';
import { date, time } from '@/lib/format';
import ActionButton from './action-button';
import MeetingDialog from './meeting-dialog';
import PostDialog from './post-dialog';
import { UpdateItem } from './updates-panel';

/** Server component: upcoming (next one highlighted) and past meetings, each with its minutes. */
export default function MeetingsPanel({ campaign, meetings, updates, perms, userId, t, locale, today }) {
    const minutesBy = {};
    for (const u of updates) if (u.update_type === 'minutes' && u.event_id) (minutesBy[u.event_id] ??= []).push(u);

    const item = (m, { next = false, past = false } = {}) => (
        <li
            key={m.id}
            className={`rounded-lg border bg-white p-4 shadow-sm ${next ? 'border-brand-orange ring-1 ring-brand-orange/40' : 'border-surface-border'}`}
        >
            <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="flex min-w-0 gap-3">
                    <div className={`w-14 shrink-0 rounded-md py-1 text-center ${next ? 'bg-orange-50' : 'bg-accent'}`}>
                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">{date(m.start_date, locale).split(' ')[1]}</p>
                        <p className="text-base font-semibold text-primary tabular-nums">{Number(m.start_date.slice(8, 10))}</p>
                    </div>
                    <div className="min-w-0">
                        {next && <p className="text-[11px] uppercase tracking-wide text-ink-gray">{t('fundraise.nextMeeting')}</p>}
                        <p className="font-medium text-primary">{date(m.start_date, locale)}</p>
                        <p className="flex flex-wrap gap-x-3 text-xs text-ink-gray">
                            {m.start_time && (
                                <span className="inline-flex items-center gap-1">
                                    <Clock className="size-3" /> {time(m.start_time)}
                                </span>
                            )}
                            {m.location && (
                                <span className="inline-flex items-center gap-1 break-words">
                                    <MapPin className="size-3" /> {m.location}
                                </span>
                            )}
                        </p>
                    </div>
                </div>
                <div className="flex flex-wrap gap-2">
                    {perms.post && (
                        <PostDialog campaignId={campaign.id} meetingId={m.id} subtitle={t('fundraise.minutesOf', { date: date(m.start_date, locale) })} />
                    )}
                    {perms.manage && !past && <MeetingDialog campaignId={campaign.id} meeting={m} today={today} />}
                    {perms.manage && (
                        <ActionButton
                            action={cancelMeeting.bind(null, campaign.id, m.id)}
                            confirm={t('fundraise.cancelMeetingConfirm')}
                            icon={<CalendarX className="size-3.5" />}
                            danger
                        >
                            {t('fundraise.cancelMeeting')}
                        </ActionButton>
                    )}
                </div>
            </div>
            {m.agenda && (
                <div className="mt-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-gray">{t('fundraise.agenda')}</p>
                    <p className="mt-0.5 whitespace-pre-line text-sm text-ink break-words">{m.agenda}</p>
                </div>
            )}
            {minutesBy[m.id]?.length > 0 && (
                <div className="mt-3 space-y-2 border-t border-surface-border pt-3">
                    <p className="text-[11px] uppercase tracking-wide text-ink-gray">{t('fundraise.minutes')}</p>
                    <ul className="space-y-2">
                        {minutesBy[m.id].map((u) => (
                            <UpdateItem key={u.id} u={u} campaignId={campaign.id} perms={perms} userId={userId} t={t} locale={locale} compact />
                        ))}
                    </ul>
                </div>
            )}
        </li>
    );

    return (
        <div className="space-y-5">
            {perms.manage && (
                <div className="flex justify-end">
                    <MeetingDialog campaignId={campaign.id} today={today} defaultPlace={campaign.location ?? ''} />
                </div>
            )}
            <section>
                <h3 className="mb-2 text-sm font-semibold text-primary">{t('fundraise.upcomingMeetings')}</h3>
                {meetings.upcoming.length === 0 ? (
                    <p className="rounded-lg border border-surface-border bg-white px-4 py-8 text-center text-sm text-ink-gray">{t('fundraise.noMeetings')}</p>
                ) : (
                    <ul className="space-y-3">{meetings.upcoming.map((m, i) => item(m, { next: i === 0 }))}</ul>
                )}
            </section>
            {meetings.past.length > 0 && (
                <section>
                    <h3 className="mb-2 text-sm font-semibold text-primary">{t('fundraise.pastMeetings')}</h3>
                    <ul className="space-y-3">{meetings.past.map((m) => item(m, { past: true }))}</ul>
                </section>
            )}
        </div>
    );
}
