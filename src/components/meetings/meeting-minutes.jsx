'use client';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { loadMeetingMinutes } from '@/app/actions/minutes';
import { useT } from '@/lib/i18n/client';

/**
 * A meeting's minutes, collapsed: "Minutes (n)" opens them, and only then are they fetched from the server
 * (the list page carries just the count). Re-fetched when the count changes (one was just added).
 * @param {{ campaignId: number, eventId: number, count: number }} props
 */
export default function MeetingMinutes({ campaignId, eventId, count }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    const [rows, setRows] = useState(null); // null = not loaded yet
    const [loadedFor, setLoadedFor] = useState(0); // the count they were loaded at
    const [error, setError] = useState(false);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        if (!open || (rows && loadedFor === count)) return;
        startTransition(async () => {
            const res = await loadMeetingMinutes(campaignId, eventId);
            if (res?.ok) {
                setRows(res.minutes);
                setLoadedFor(count);
                setError(false);
            } else setError(true);
        });
    }, [open, count, rows, loadedFor, campaignId, eventId]);

    if (!count) return null;
    return (
        <div>
            <button
                type="button"
                onClick={() => setOpen((v) => !v)}
                aria-expanded={open}
                className="inline-flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
            >
                {t('meetings.showMinutes', { count })}
                {pending ? (
                    <Loader2 className="size-3.5 animate-spin" />
                ) : (
                    <ChevronDown className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                )}
            </button>
            {open && (
                <div className="mt-1.5 space-y-1.5">
                    {error && <p className="text-xs text-destructive">{t('common.error')}</p>}
                    {rows?.map((u) => (
                        <div key={u.id} className="rounded-md bg-surface-login px-2.5 py-1.5">
                            <p className="whitespace-pre-line break-words text-sm text-ink">{u.body}</p>
                            <p className="text-[11px] text-ink-gray">{(locale !== 'en' && u.author_local) || u.author}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
