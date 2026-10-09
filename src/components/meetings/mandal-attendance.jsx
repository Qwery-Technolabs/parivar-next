'use client';
import { Check, ChevronDown, Minus, Users, X } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setMandalPresence } from '@/app/actions/mandal';
import { useT } from '@/lib/i18n/client';

/**
 * A Mandal schedule on the Meetings tab: "n came · n absent · n not marked", opening the members it
 * is for. Those who run the Mandal mark each one Came / Absent right here (saved at once, the same
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
                <ul className="mt-1.5 grid gap-x-4 gap-y-1 sm:grid-cols-2">
                    {people.map((p) => {
                        const name = (locale !== 'en' && p.full_name_local) || p.full_name;
                        return (
                            <li key={p.id} className="flex min-w-0 items-center gap-2 text-xs">
                                {editable ? (
                                    <span className="inline-flex shrink-0 rounded-md bg-surface-bggray/70 p-0.5" role="radiogroup" aria-label={name}>
                                        {[true, false].map((v) => (
                                            <button
                                                key={String(v)}
                                                type="button"
                                                role="radio"
                                                aria-checked={p.present === v}
                                                disabled={busy === p.id}
                                                onClick={() => mark(p, v)}
                                                title={t(v ? 'mandal.present' : 'mandal.absent')}
                                                className={`inline-flex h-6 items-center gap-1 rounded px-1.5 text-[11px] font-medium disabled:opacity-60 ${
                                                    p.present === v
                                                        ? v
                                                            ? 'bg-emerald-700 text-white shadow-sm'
                                                            : 'bg-rose-700 text-white shadow-sm'
                                                        : 'text-ink-gray hover:text-primary'
                                                }`}
                                            >
                                                {v ? <Check className="size-3" /> : <X className="size-3" />}
                                                {t(v ? 'mandal.present' : 'mandal.absent')}
                                            </button>
                                        ))}
                                    </span>
                                ) : p.present === true ? (
                                    <Check className="size-3.5 shrink-0 text-emerald-700" aria-label={t('mandal.present')} />
                                ) : p.present === false ? (
                                    <X className="size-3.5 shrink-0 text-rose-700" aria-label={t('mandal.absent')} />
                                ) : (
                                    <Minus className="size-3.5 shrink-0 text-ink-gray" aria-label={t('mandal.notMarked')} />
                                )}
                                <span className="truncate text-ink">{name}</span>
                            </li>
                        );
                    })}
                </ul>
            )}
        </>
    );
}
