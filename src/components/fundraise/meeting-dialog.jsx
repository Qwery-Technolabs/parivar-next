'use client';
import { CalendarPlus, Pencil } from 'lucide-react';
import { saveMeeting } from '@/app/actions/fundraise';
import { Field, textArea, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useT } from '@/lib/i18n/client';

/** Schedule a new meeting, or edit one when `meeting` is given. */
export default function MeetingDialog({ campaignId, meeting = null, today, defaultPlace = '' }) {
    const { t } = useT();
    const editing = Boolean(meeting);
    return (
        <FormDialog
            title={editing ? t('fundraise.editMeeting') : t('fundraise.scheduleMeeting')}
            action={saveMeeting}
            hidden={{ campaign_id: campaignId, meeting_id: meeting?.id ?? '' }}
            submitIcon={editing ? Pencil : CalendarPlus}
            submitLabel={editing ? t('common.save') : t('fundraise.scheduleMeeting')}
            trigger={({ open }) =>
                editing ? (
                    <button
                        type="button"
                        onClick={open}
                        className="inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-surface-border bg-white px-2.5 text-xs font-medium text-primary hover:bg-accent"
                    >
                        <Pencil className="size-3.5" /> {t('common.edit')}
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={open}
                        className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                    >
                        <CalendarPlus className="size-4" /> {t('fundraise.scheduleMeeting')}
                    </button>
                )
            }
        >
            {({ fieldError }) => (
                <>
                    <div className="grid gap-4 sm:grid-cols-2">
                        <Field label={t('fundraise.meetingDate')} error={fieldError('start_date')} required>
                            <input
                                type="date"
                                name="start_date"
                                min={editing ? undefined : today}
                                defaultValue={meeting?.start_date ?? ''}
                                className={`${textInput(!!fieldError('start_date'))} w-full`}
                            />
                        </Field>
                        <Field label={t('fundraise.meetingTime')} error={fieldError('start_time')}>
                            <input
                                type="time"
                                name="start_time"
                                defaultValue={meeting?.start_time?.slice(0, 5) ?? ''}
                                className={`${textInput(!!fieldError('start_time'))} w-full`}
                            />
                        </Field>
                    </div>
                    <Field label={t('fundraise.meetingPlace')}>
                        <input name="location" maxLength={200} defaultValue={meeting?.location ?? defaultPlace} className={`${textInput()} w-full`} />
                    </Field>
                    <Field label={t('fundraise.agenda')}>
                        <textarea name="agenda" rows={4} defaultValue={meeting?.agenda ?? ''} className={`${textArea()} w-full`} />
                    </Field>
                </>
            )}
        </FormDialog>
    );
}
