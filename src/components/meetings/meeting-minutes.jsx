'use client';
import { ChevronDown, Loader2 } from 'lucide-react';
import { useState } from 'react';
import { loadMeetingMinutes } from '@/app/actions/minutes';
import { useOnDemand } from '@/lib/client-cache';
import { useT } from '@/lib/i18n/client';

/**
 * A meeting's minutes, collapsed: "Minutes (n)" opens them, and only then are they fetched from the server
 * (the list page carries just the count). Kept in this tab for a few minutes and fetched early when the pointer / a
 * finger reaches it (lib/client-cache.js); the count is in the key, so a new minute loads afresh.
 * @param {{ campaignId: number, eventId: number, count: number }} props
 */
export default function MeetingMinutes({ campaignId, eventId, count }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    const { res, pending, load, prefetch } = useOnDemand(`min:${campaignId}:${eventId}:${count}`, () => loadMeetingMinutes(campaignId, eventId));
    const rows = res?.ok ? res.minutes : null; // null = not loaded yet
    const error = Boolean(res && !res.ok);
    const toggle = () => {
        if (!open && !res) load();
        setOpen((v) => !v);
    };

    if (!count) return null;
    return (
        <div>
            <button
                type="button"
                onClick={toggle}
                onPointerEnter={prefetch}
                onTouchStart={prefetch}
                onFocus={prefetch}
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
