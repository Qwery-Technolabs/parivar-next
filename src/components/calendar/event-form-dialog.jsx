'use client';
import { Save } from 'lucide-react';
import { startTransition, useActionState } from 'react';
import { toast } from 'sonner';
import { saveEvent } from '@/app/actions/events';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import { useT } from '@/lib/i18n/client';

/**
 * Create / edit an event. Loaded with next/dynamic on first open — the calendar
 * page ships without this form's code until someone actually adds or edits.
 * @param {{ open: boolean, onOpenChange: (v: boolean) => void, event?: any, groups: Array<{id: number, name: string, name_gu?: string}>, types: string[], defaultDate?: string }} props
 */
export default function EventFormDialog({ open, onOpenChange, event, groups, types, defaultDate }) {
    const { t } = useT();
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-primary">
                        {event ? t('calendar.edit') : t('calendar.add')}
                    </DialogTitle>
                </DialogHeader>
                {/* Keyed so reopening for another event starts clean. */}
                <EventForm
                    key={event?.id ?? 'new'}
                    event={event}
                    groups={groups}
                    types={types}
                    defaultDate={defaultDate}
                    onDone={() => onOpenChange(false)}
                />
            </DialogContent>
        </Dialog>
    );
}

function EventForm({ event, groups, types, defaultDate, onDone }) {
    const { t, locale } = useT();
    const [state, action, pending] = useActionState(async (prev, fd) => {
        const res = (await saveEvent(prev, fd)) ?? {};
        if (res.ok) {
            toast.success(t(res.message ?? 'common.saved'));
            onDone();
        }
        return res;
    }, null);
    const fe = (name) => (state?.fieldErrors?.[name] ? t(state.fieldErrors[name]) : null);
    const e = event ?? {};

    return (
        <form
            // Not <form action>: React resets uncontrolled fields after a form action,
            // which would wipe the input when the server returns a validation error.
            onSubmit={(ev) => {
                ev.preventDefault();
                const fd = new FormData(ev.currentTarget);
                startTransition(() => action(fd));
            }}
            className="space-y-4"
        >
            {event && <input type="hidden" name="id" value={event.id} />}
            <Field label={t('calendar.name')} required error={fe('title')}>
                <input name="title" defaultValue={e.title ?? ''} required maxLength={200} className={`${textInput(!!fe('title'))} w-full`} />
            </Field>
            <Field label={t('calendar.nameGu')}>
                <input name="title_gu" lang="gu" defaultValue={e.title_gu ?? ''} maxLength={200} className={`${textInput()} w-full`} />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('calendar.type')}>
                    <select name="event_type" defaultValue={e.event_type ?? 'event'} className={`${selectInput()} w-full`}>
                        {types.map((ty) => (
                            <option key={ty} value={ty}>
                                {t(`calendar.types.${ty}`)}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label={t('calendar.group')} error={fe('group_id')}>
                    <select name="group_id" defaultValue={e.group_id ?? ''} className={`${selectInput(!!fe('group_id'))} w-full`}>
                        <option value="">—</option>
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                                {(locale === 'gu' && g.name_gu) || g.name}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
                <Field label={t('calendar.startDate')} required error={fe('start_date')}>
                    <input
                        name="start_date"
                        type="date"
                        required
                        defaultValue={e.start_date ?? defaultDate ?? ''}
                        className={`${textInput(!!fe('start_date'))} w-full`}
                    />
                </Field>
                <Field label={t('calendar.endDate')} error={fe('end_date')} hint={t('calendar.endHint')}>
                    <input name="end_date" type="date" defaultValue={e.end_date ?? ''} className={`${textInput(!!fe('end_date'))} w-full`} />
                </Field>
                <Field label={t('calendar.time')} error={fe('start_time')}>
                    <input
                        name="start_time"
                        type="time"
                        defaultValue={e.start_time ? String(e.start_time).slice(0, 5) : ''}
                        className={`${textInput(!!fe('start_time'))} w-full`}
                    />
                </Field>
            </div>
            <Field label={t('calendar.location')}>
                <input name="location" defaultValue={e.location ?? ''} maxLength={200} className={`${textInput()} w-full`} />
            </Field>
            <Field label={t('calendar.description')}>
                <textarea name="description" defaultValue={e.description ?? ''} maxLength={5000} className={`${textArea()} w-full`} />
            </Field>
            {state?.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {t(state.error)}
                </p>
            )}
            <div className="flex flex-col-reverse gap-2 pt-1 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={onDone}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent"
                >
                    {t('common.cancel')}
                </button>
                <SubmitButton icon={Save} pendingText={t('common.saving')} pending={pending}>
                    {t('common.save')}
                </SubmitButton>
            </div>
        </form>
    );
}
