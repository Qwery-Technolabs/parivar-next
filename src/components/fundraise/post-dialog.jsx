'use client';
import { MessageSquarePlus, NotebookPen } from 'lucide-react';
import { postUpdate } from '@/app/actions/fundraise';
import { Field, textArea } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useT } from '@/lib/i18n/client';

/** Post an update, or minutes for one meeting when `meetingId` is given. */
export default function PostDialog({ campaignId, meetingId = null, subtitle }) {
    const { t } = useT();
    const minutes = Boolean(meetingId);
    const label = minutes ? t('fundraise.addMinutes') : t('fundraise.postUpdate');
    const Icon = minutes ? NotebookPen : MessageSquarePlus;
    return (
        <FormDialog
            title={label}
            description={subtitle}
            action={postUpdate}
            hidden={{ campaign_id: campaignId, meeting_id: meetingId ?? '' }}
            submitIcon={Icon}
            submitLabel={minutes ? t('common.save') : t('fundraise.postUpdate')}
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    className={
                        minutes
                            ? 'btn-secondary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium'
                            : 'inline-flex h-9 shrink-0 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90'
                    }
                >
                    <Icon className={minutes ? 'size-3.5' : 'size-4'} /> {label}
                </button>
            )}
        >
            {({ fieldError }) => (
                <Field label={minutes ? t('fundraise.minutesBody') : t('fundraise.updateBody')} error={fieldError('body')} required>
                    <textarea name="body" rows={6} className={`${textArea(!!fieldError('body'))} w-full`} />
                </Field>
            )}
        </FormDialog>
    );
}
