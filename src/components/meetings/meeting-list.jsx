'use client';
import { Check, ChevronDown, Clock, HelpCircle, MapPin, Trash2, Users, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cancelMeeting, setRsvp } from '@/app/actions/meetings';
import { date as fmtDate, time as fmtTime } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import PostDialog from '@/components/fundraise/post-dialog';
import MeetingDialog from './meeting-dialog';

const RSVP = {
    yes: { icon: Check, on: 'bg-emerald-700 text-white', tone: 'text-emerald-700' },
    maybe: { icon: HelpCircle, on: 'bg-amber-700 text-white', tone: 'text-amber-800' },
    no: { icon: X, on: 'bg-rose-700 text-white', tone: 'text-rose-700' },
    pending: { icon: Clock, on: '', tone: 'text-ink-gray' },
};

function MeetingCard({ m, scope, scopeId, manage, people, me, past, today, minutes = [], canPostMinutes = false }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    const [pending, startTransition] = useTransition();
    const title = (locale !== 'en' && m.title_local) || m.title;
    const invited = m.attendees.some((a) => a.user_id === me);
    const run = (fn, msg) =>
        startTransition(async () => {
            const res = await fn();
            if (res?.ok) msg && toast.success(t(msg));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    const pendingN = m.invited - m.yes_n - m.maybe_n - m.no_n;
    const [, mon, day] = m.start_date.split('-');

    return (
        <li className={`rounded-lg border bg-white p-3 shadow-sm ${past ? 'border-surface-border opacity-80' : 'border-surface-border'} ${pending ? 'cursor-wait opacity-70' : ''}`}>
            <div className="flex items-start gap-3">
                <div className={`w-12 shrink-0 rounded-md py-1 text-center ${past ? 'bg-surface-bggray' : 'bg-accent'}`}>
                    <p className="text-[10px] uppercase tracking-wide text-ink-gray">{fmtDate(m.start_date, locale).split(' ')[1] ?? mon}</p>
                    <p className="text-base font-semibold tabular-nums text-primary">{Number(day)}</p>
                </div>
                <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-semibold text-primary">{title}</p>
                    <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-ink-gray">
                        <span className="inline-flex items-center gap-1">
                            <Clock className="size-3" /> {fmtDate(m.start_date, locale)}
                            {m.start_time && ` · ${fmtTime(m.start_time)}`}
                        </span>
                        {m.location && (
                            <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3" /> {m.location}
                            </span>
                        )}
                    </p>
                    {m.agenda && <p className="mt-1 whitespace-pre-line break-words text-sm text-ink">{m.agenda}</p>}
                    <button type="button" onClick={() => setOpen((v) => !v)} className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline">
                        <Users className="size-3.5" />
                        {t('meetings.counts', { yes: m.yes_n, maybe: m.maybe_n, no: m.no_n, pending: pendingN })}
                        <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                    </button>
                    {open && (
                        <ul className="mt-1.5 grid gap-x-4 gap-y-0.5 sm:grid-cols-2">
                            {m.attendees.map((a) => {
                                const R = RSVP[a.rsvp] ?? RSVP.pending;
                                return (
                                    <li key={a.user_id} className="flex items-center gap-1.5 text-xs">
                                        <R.icon className={`size-3.5 shrink-0 ${R.tone}`} />
                                        <span className="truncate text-ink">{(locale !== 'en' && a.full_name_local) || a.full_name}</span>
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                </div>
                {manage && !past && (
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                        <MeetingDialog scope={scope} scopeId={scopeId} people={people} meeting={m} today={today} />
                        <button
                            type="button"
                            onClick={() => window.confirm(t('meetings.cancelConfirm')) && run(() => cancelMeeting(scope, scopeId, m.id), 'meetings.cancelled')}
                            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10"
                        >
                            <Trash2 className="size-3.5" /> {t('meetings.cancel')}
                        </button>
                    </div>
                )}
            </div>
            {(minutes.length > 0 || (canPostMinutes && past)) && (
                <div className="mt-2.5 space-y-1.5 border-t border-surface-border pt-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">{t('fundraise.minutes')}</p>
                        {canPostMinutes && past && <PostDialog campaignId={scopeId} meetingId={m.id} subtitle={t('fundraise.minutesOf', { date: fmtDate(m.start_date, locale) })} />}
                    </div>
                    {minutes.map((u) => (
                        <div key={u.id} className="rounded-md bg-surface-login px-2.5 py-1.5">
                            <p className="whitespace-pre-line break-words text-sm text-ink">{u.body}</p>
                            <p className="text-[11px] text-ink-gray">{(locale !== 'en' && u.author_local) || u.author}</p>
                        </div>
                    ))}
                </div>
            )}
            {invited && !past && (
                <div className="mt-2.5 flex flex-wrap items-center gap-2 border-t border-surface-border pt-2.5">
                    <span className="text-xs font-medium text-ink-gray">{t('meetings.yourAnswer')}</span>
                    {['yes', 'maybe', 'no'].map((r) => {
                        const R = RSVP[r];
                        const on = m.my_rsvp === r;
                        return (
                            <button
                                key={r}
                                type="button"
                                disabled={pending}
                                aria-pressed={on}
                                onClick={() => run(() => setRsvp(m.id, r))}
                                className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-xs font-medium ring-1 ring-inset ${
                                    on ? `${R.on} ring-transparent` : 'bg-white text-primary ring-surface-border hover:bg-accent'
                                }`}
                            >
                                <R.icon className="size-3.5" /> {t(`meetings.rsvp.${r}`)}
                            </button>
                        );
                    })}
                </div>
            )}
        </li>
    );
}

/**
 * Upcoming meetings (soonest first) and, folded away, past ones.
 * @param {{ meetings: any[], scope: string, scopeId: number, manage: boolean, people: any[], me: number, today: string, defaultTitle?: string, defaultPlace?: string }} props
 */
export default function MeetingList({ meetings, scope, scopeId, manage, people, me, today, defaultTitle, defaultPlace, minutes = [], canPostMinutes = false }) {
    const minutesOf = (id) => minutes.filter((u) => u.event_id === id);
    const { t } = useT();
    const [showPast, setShowPast] = useState(false);
    const upcoming = meetings.filter((m) => m.start_date >= today).reverse();
    const past = meetings.filter((m) => m.start_date < today);

    return (
        <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">{t('meetings.title_plural')}</h2>
                {manage && <MeetingDialog scope={scope} scopeId={scopeId} people={people} today={today} defaultTitle={defaultTitle} defaultPlace={defaultPlace} compact />}
            </div>
            {upcoming.length === 0 && <p className="rounded-lg border border-surface-border bg-white px-4 py-6 text-center text-sm text-ink-gray">{t('meetings.none')}</p>}
            <ul className="space-y-2">
                {upcoming.map((m) => (
                    <MeetingCard key={m.id} m={m} scope={scope} scopeId={scopeId} manage={manage} people={people} me={me} today={today} minutes={minutesOf(m.id)} canPostMinutes={canPostMinutes} />
                ))}
            </ul>
            {past.length > 0 && (
                <>
                    <button type="button" onClick={() => setShowPast((v) => !v)} className="inline-flex items-center gap-1 text-xs font-medium text-ink-gray hover:text-primary">
                        <ChevronDown className={`size-3.5 transition-transform ${showPast ? 'rotate-180' : ''}`} /> {t('meetings.past', { count: past.length })}
                    </button>
                    {showPast && (
                        <ul className="space-y-2">
                            {past.map((m) => (
                                <MeetingCard key={m.id} m={m} scope={scope} scopeId={scopeId} manage={manage} people={people} me={me} today={today} past minutes={minutesOf(m.id)} canPostMinutes={canPostMinutes} />
                            ))}
                        </ul>
                    )}
                </>
            )}
        </section>
    );
}
