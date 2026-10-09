'use client';
import { Check, ChevronDown, Minus, Users, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setMandalPresence } from '@/app/actions/mandal';
import { useT } from '@/lib/i18n/client';

/**
 * A Mandal schedule on the Meetings tab: "n came · n absent · n not marked", opening the members it
 * is for, each with ✓ / ✗ / – (came / absent / not marked). Those who run the Mandal tap a row to switch it (saved at once, the same
 * attendance as the Savings sheet; payments untouched). Not on an archived or future schedule.
 * @param {{ campaignId: number, eventId: number, data: { archived: boolean, people: Array<{ id, full_name, full_name_local, present: boolean|null }> }, canMark: boolean }} props
 */
export default function MandalAttendance({ campaignId, eventId, data, canMark }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    // Marked here: shown at once, put back if the save fails.
    const [local, setLocal] = useState({});
    const [busy, setBusy] = useState(null);
    const [, startTransition] = useTransition();
    const editable = canMark && !data.archived;
    const people = data.people.map((p) => ({ ...p, present: p.id in local ? local[p.id] : p.present }));
    const came = people.filter((p) => p.present === true).length;
    const absent = people.filter((p) => p.present === false).length;

    const mark = (p, present) => {
        if (busy || p.present === present) return;
        setBusy(p.id);
        setLocal((s) => ({ ...s, [p.id]: present }));
        startTransition(async () => {
            const res = await setMandalPresence(campaignId, eventId, p.id, present);
            if (!res?.ok) {
                setLocal((s) => {
                    const next = { ...s };
                    delete next[p.id];
                    return next;
                });
                toast.error(t(res?.error ?? 'common.error'));
            }
            setBusy(null);
        });
    };

    return (
        <>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                className="mt-1.5 inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
                <Users className="size-3.5" />
                {t('mandal.attendanceCounts', { came, absent, none: people.length - came - absent })}
                <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
            </button>
            {open && (
                <ul className="mt-1.5 grid gap-x-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                    {people.map((p) => {
                        const name = (locale !== 'en' && p.full_name_local) || p.full_name;
                        const Icon = p.present === true ? Check : p.present === false ? X : Minus;
                        const tone = p.present === true ? 'text-emerald-700' : p.present === false ? 'text-rose-700' : 'text-ink-gray';
                        const state = t(p.present === true ? 'mandal.present' : p.present === false ? 'mandal.absent' : 'mandal.notMarked');
                        // Same ✓ / ✗ / – for everyone; who runs it taps the row to switch (– or ✗ → ✓, ✓ → ✗).
                        return (
                            <li key={p.id} className="min-w-0 text-xs leading-5">
                                {editable ? (
                                    <button
                                        type="button"
                                        disabled={busy === p.id}
                                        onClick={() => mark(p, p.present !== true)}
                                        title={state}
                                        className="-mx-1 flex w-full min-w-0 items-center gap-1.5 rounded px-1 text-left hover:bg-accent disabled:opacity-60"
                                    >
                                        <Icon className={`size-3.5 shrink-0 ${tone}`} aria-label={state} />
                                        <span className="truncate text-ink">{name}</span>
                                    </button>
                                ) : (
                                    <span className="flex min-w-0 items-center gap-1.5">
                                        <Icon className={`size-3.5 shrink-0 ${tone}`} aria-label={state} />
                                        <span className="truncate text-ink">{name}</span>
                                    </span>
                                )}
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
}
