'use client';
import { ChevronDown, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteMinutes, editMinutes, loadMeetingMinutes } from '@/app/actions/minutes';
import { Field, textArea } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useOnDemand } from '@/lib/client-cache';
import { useT } from '@/lib/i18n/client';

/**
 * A meeting's minutes, collapsed: the "Minutes (n)" button (left) opens them, and only then are they fetched from the
 * server (the list page carries just the count); `addButton` (Add minutes) sits at the right of the same row. Kept in
 * this tab for a few minutes and fetched early when the pointer / a finger reaches it (lib/client-cache.js); the count
 * is in the key, so a new minute loads afresh. Each minute shows Edit / Delete (icons, right) to whoever may change it
 * (its author, app admins / sub-admins, those who manage it, its group's admins / sub-admins / Meetings team role).
 * @param {{ campaignId: number, eventId: number, count: number, addButton?: React.ReactNode }} props
 */
export default function MeetingMinutes({ campaignId, eventId, count, addButton = null }) {
    const { t, locale } = useT();
    const [open, setOpen] = useState(false);
    const [busy, startBusy] = useTransition();
    const key = (n) => `min:${campaignId}:${eventId}:${n}`;
    const { res, pending, load, reload, prefetch } = useOnDemand(key(count), () => loadMeetingMinutes(campaignId, eventId));
    const rows = res?.ok ? res.minutes : null; // null = not loaded yet
    const error = Boolean(res && !res.ok);
    const toggle = () => {
        if (!open && !res) load();
        setOpen((v) => !v);
    };
    const remove = (id) => {
        if (!window.confirm(t('fundraise.deleteMinutesConfirm'))) return;
        startBusy(async () => {
            const r = await deleteMinutes(campaignId, id);
            if (!r?.ok) return void toast.error(t(r?.error ?? 'common.error'));
            toast.success(t(r.message));
            // One fewer: fetched under the next count, ready when the page brings it.
            if (count > 1) reload(key(count - 1));
        });
    };

    if (!count && !addButton) return null;
    return (
        <div>
            <div className="flex items-center justify-between gap-2">
                {count > 0 ? (
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
                ) : (
                    <span />
                )}
                {addButton}
            </div>
            {open && count > 0 && (
                <div className={`mt-1.5 space-y-1.5 ${busy ? 'cursor-wait opacity-70' : ''}`}>
                    {error && <p className="text-xs text-destructive">{t('common.error')}</p>}
                    {rows?.map((u) => (
                        <div key={u.id} className="flex items-start gap-2 rounded-md bg-surface-login px-2.5 py-1.5">
                            <div className="min-w-0 flex-1">
                                <p className="whitespace-pre-line break-words text-[13px] leading-relaxed text-ink">{u.body}</p>
                                <p className="text-[11px] text-ink-gray">{(locale !== 'en' && u.author_local) || u.author}</p>
                            </div>
                            {u.canChange && (
                                <div className="flex shrink-0 items-center gap-1">
                                    <FormDialog
                                        title={t('fundraise.editMinutes')}
                                        action={editMinutes}
                                        hidden={{ campaign_id: campaignId, minute_id: u.id }}
                                        submitIcon={Pencil}
                                        onSuccess={() => reload()}
                                        trigger={({ open: openEdit }) => (
                                            <button
                                                type="button"
                                                onClick={openEdit}
                                                disabled={busy}
                                                aria-label={t('common.edit')}
                                                title={t('common.edit')}
                                                className="inline-flex size-7 items-center justify-center rounded-md border border-surface-border bg-white text-primary hover:bg-accent"
                                            >
                                                <Pencil className="size-3.5" />
                                            </button>
                                        )}
                                    >
                                        {({ fieldError }) => (
                                            <Field label={t('fundraise.minutesBody')} error={fieldError('body')} required>
                                                <textarea name="body" rows={8} defaultValue={u.body} className={`${textArea(!!fieldError('body'))} w-full`} />
                                            </Field>
                                        )}
                                    </FormDialog>
                                    <button
                                        type="button"
                                        onClick={() => remove(u.id)}
                                        disabled={busy}
                                        aria-label={t('common.delete')}
                                        title={t('common.delete')}
                                        className="inline-flex size-7 items-center justify-center rounded-md bg-destructive text-white hover:bg-destructive/90"
                                    >
                                        <Trash2 className="size-3.5" />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
