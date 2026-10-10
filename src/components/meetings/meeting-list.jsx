'use client';
import { CalendarDays, Check, ChevronDown, Clock, HelpCircle, List, MapPin, Trash2, Users, X, Cake } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { cancelMeeting, setRsvp } from '@/app/actions/meetings';
import { date as fmtDate, time as fmtTime } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import PostDialog from '@/components/fundraise/post-dialog';
import MeetingCalendar from './meeting-calendar';
import { selectInput } from '@/components/ui/field';
import MeetingDialog from './meeting-dialog';
import MandalAttendance from './mandal-attendance';

const RSVP = {
    yes: { icon: Check, on: 'bg-emerald-700 text-white', tone: 'text-emerald-700' },
    maybe: { icon: HelpCircle, on: 'bg-amber-700 text-white', tone: 'text-amber-800' },
    no: { icon: X, on: 'bg-rose-700 text-white', tone: 'text-rose-700' },
    pending: { icon: Clock, on: '', tone: 'text-ink-gray' },
};

function MeetingCard({ m, scope, scopeId, canEdit, people, me, past, today, minutes = [], canPostMinutes = false, attendance = null, canMark = false }) {
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
        <li
            className={`rounded-lg border bg-white p-3 shadow-sm ${past ? 'border-surface-border opacity-80' : 'border-surface-border'} ${pending ? 'cursor-wait opacity-70' : ''}`}
        >
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
                    {attendance ? (
                        // A Mandal schedule: who came, not who replied.
                        <MandalAttendance campaignId={scopeId} eventId={m.id} data={attendance} canMark={canMark && m.start_date <= today} />
                    ) : (
                        <button
                            type="button"
                            onClick={() => setOpen((v) => !v)}
                            className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
                        >
                            <Users className="size-3.5" />
                            {t('meetings.counts', { yes: m.yes_n, maybe: m.maybe_n, no: m.no_n, pending: pendingN })}
                            <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                    )}
                    {!attendance && open && (
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
                {canEdit && !past && (
                    <div className="flex shrink-0 items-center gap-1.5">
                        {/* Edit and Cancel side by side; Cancel is the red one. */}
                        <MeetingDialog scope={scope} scopeId={scopeId} people={people} meeting={m} today={today} />
                        <button
                            type="button"
                            onClick={() => window.confirm(t('meetings.cancelConfirm')) && run(() => cancelMeeting(scope, scopeId, m.id), 'meetings.cancelled')}
                            aria-label={t('meetings.cancel')}
                            title={t('meetings.cancel')}
                            className="inline-flex size-8 items-center justify-center gap-1.5 rounded-md bg-destructive text-xs font-medium text-white hover:bg-destructive/90 sm:w-auto sm:px-2.5"
                        >
                            <Trash2 className="size-3.5" /> <span className="hidden sm:inline">{t('meetings.cancel')}</span>
                        </button>
                    </div>
                )}
            </div>
            {(minutes.length > 0 || (canPostMinutes && past)) && (
                <div className="mt-2.5 space-y-1.5 border-t border-surface-border pt-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">{t('fundraise.minutes')}</p>
                        {canPostMinutes && past && (
                            <PostDialog campaignId={scopeId} meetingId={m.id} subtitle={t('fundraise.minutesOf', { date: fmtDate(m.start_date, locale) })} />
                        )}
                    </div>
                    {minutes.map((u) => (
                        <div key={u.id} className="rounded-md bg-surface-login px-2.5 py-1.5">
                            <p className="whitespace-pre-line break-words text-sm text-ink">{u.body}</p>
                            <p className="text-[11px] text-ink-gray">{(locale !== 'en' && u.author_local) || u.author}</p>
                        </div>
                    ))}
                </div>
            )}
            {invited && !past && !attendance && (
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
 * Upcoming meetings (soonest first) and, folded away, past ones — or the same meetings on a
 * month calendar. View is ?view=calendar (default list = absence), so it survives reload/back.
 */
export default function MeetingList({
    meetings,
    scope,
    scopeId,
    manage,
    moderate = false,
    people,
    me,
    today,
    defaultTitle,
    defaultPlace,
    minutes = [],
    canPostMinutes = false,
    birthdays = [],
    birthdayRoles = [],
    attendance = null,
}) {
    const minutesOf = (id) => minutes.filter((u) => u.event_id === id);
    const { t, locale } = useT();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const view = searchParams.get('view') === 'calendar' ? 'calendar' : 'list';
    const [showPast, setShowPast] = useState(false);
    // Calendar filters: meetings and/or birthdays; birthdays of one role only.
    const [show, setShow] = useState('all');
    const [role, setRole] = useState('');
    const calMeetings = show === 'birthday' ? [] : meetings;
    const calBirthdays = show === 'meeting' ? [] : birthdays.filter((b) => !role || b.role === role);
    const upcoming = meetings.filter((m) => m.start_date >= today).reverse();
    const past = meetings.filter((m) => m.start_date < today);
    const card = (m) => (
        <MeetingCard
            key={m.id}
            m={m}
            scope={scope}
            scopeId={scopeId}
            // Edit / cancel: the group's leaders (fundraise: its managers), or whoever scheduled it.
            canEdit={moderate || m.created_by === me}
            people={people}
            me={me}
            today={today}
            past={m.start_date < today}
            minutes={minutesOf(m.id)}
            canPostMinutes={canPostMinutes}
            attendance={attendance?.byEvent?.[m.id] ?? null}
            canMark={Boolean(attendance?.canMark)}
        />
    );

    function setView(v) {
        const params = new URLSearchParams(searchParams.toString());
        if (v === 'calendar') params.set('view', 'calendar');
        else params.delete('view');
        const qs = params.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }

    return (
        <section className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                    <h2 className="text-sm font-semibold text-primary">{t('meetings.title_plural')}</h2>
                    <div className="inline-flex rounded-md bg-surface-bggray/70 p-0.5" role="group" aria-label={t('meetings.viewLabel')}>
                        {[
                            ['list', List, t('meetings.views.list')],
                            ['calendar', CalendarDays, t('meetings.views.calendar')],
                        ].map(([v, Icon, label]) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setView(v)}
                                aria-pressed={view === v}
                                className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium ${view === v ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-brand-navy'}`}
                            >
                                <Icon className="size-3.5" /> {label}
                            </button>
                        ))}
                    </div>
                </div>
                {manage && (
                    <MeetingDialog
                        scope={scope}
                        scopeId={scopeId}
                        people={people}
                        today={today}
                        defaultTitle={defaultTitle}
                        defaultPlace={defaultPlace}
                        compact
                    />
                )}
            </div>

            {view === 'calendar' && (
                <div className="flex flex-wrap items-center gap-2">
                    <div className="inline-flex rounded-md bg-surface-bggray/70 p-0.5" role="group" aria-label={t('meetings.filterLabel')}>
                        {[
                            ['all', t('meetings.filters.all')],
                            ['meeting', t('meetings.filters.meetings')],
                            ['birthday', t('meetings.filters.birthdays')],
                        ].map(([v, label]) => (
                            <button
                                key={v}
                                type="button"
                                onClick={() => setShow(v)}
                                aria-pressed={show === v}
                                className={`inline-flex h-7 items-center rounded px-2 text-xs font-medium ${show === v ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-brand-navy'}`}
                            >
                                {label}
                            </button>
                        ))}
                    </div>
                    {show !== 'meeting' && birthdayRoles.length > 0 && (
                        <select
                            value={role}
                            onChange={(e) => setRole(e.target.value)}
                            aria-label={t('meetings.filters.birthdayRole')}
                            className={`${selectInput()} h-8 w-auto text-xs`}
                        >
                            <option value="">{t('meetings.filters.anyRole')}</option>
                            {birthdayRoles.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    )}
                </div>
            )}

            {view === 'calendar' ? (
                <MeetingCalendar
                    meetings={calMeetings}
                    birthdays={calBirthdays}
                    today={today}
                    renderDay={(day, list, dayBirthdays) => (
                        <div className="space-y-2">
                            <p className="text-xs font-semibold text-ink-gray">{fmtDate(day, locale)}</p>
                            {dayBirthdays.length > 0 && (
                                <ul className="flex flex-wrap gap-1.5">
                                    {dayBirthdays.map((b) => (
                                        <li
                                            key={b.id}
                                            className="inline-flex items-center gap-1 rounded-full bg-rose-50 px-2 py-0.5 text-xs font-medium text-rose-700"
                                        >
                                            <Cake className="size-3.5" /> {(locale !== 'en' && b.nameLocal) || b.name}
                                            {b.turns > 0 && <span className="font-normal">· {t('calendar.turns', { age: b.turns })}</span>}
                                        </li>
                                    ))}
                                </ul>
                            )}
                            {list.length === 0 && dayBirthdays.length === 0 ? (
                                <p className="rounded-lg border border-surface-border bg-white px-4 py-5 text-center text-sm text-ink-gray">
                                    {t('meetings.noneOnDay')}
                                </p>
                            ) : (
                                <ul className="space-y-2">{list.map(card)}</ul>
                            )}
                        </div>
                    )}
                />
            ) : (
                <>
                    {upcoming.length === 0 && (
                        <p className="rounded-lg border border-surface-border bg-white px-4 py-6 text-center text-sm text-ink-gray">{t('meetings.none')}</p>
                    )}
                    <ul className="space-y-2">{upcoming.map(card)}</ul>
                    {past.length > 0 && (
                        <>
                            <button
                                type="button"
                                onClick={() => setShowPast((v) => !v)}
                                className="inline-flex items-center gap-1 text-xs font-medium text-ink-gray hover:text-primary"
                            >
                                <ChevronDown className={`size-3.5 transition-transform ${showPast ? 'rotate-180' : ''}`} />{' '}
                                {t('meetings.past', { count: past.length })}
                            </button>
                            {showPast && <ul className="space-y-2">{past.map(card)}</ul>}
                        </>
                    )}
                </>
            )}
        </section>
    );
}
