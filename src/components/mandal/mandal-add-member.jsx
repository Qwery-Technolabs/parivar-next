'use client';
import { UserPlus } from 'lucide-react';
import FormDialog from '@/components/ui/form-dialog';
import PersonOrPhone from '@/components/ui/person-or-phone';
import { useT } from '@/lib/i18n/client';

/** "+ Add" on the Mandal's members card: pick someone in the app, or invite a phone number. */
export default function MandalAddMember({ campaignId, action, exclude = [] }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('mandal.addMember')}
            action={action}
            hidden={{ campaign_id: campaignId }}
            submitIcon={UserPlus}
            submitLabel={t('common.add')}
            keepOpen
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    aria-label={t('mandal.addMember')}
                    title={t('mandal.addMember')}
                    className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
                >
                    <UserPlus className="size-3.5" /> <span className="hidden sm:inline">{t('common.add')}</span>
                </button>
            )}
        >
            {({ fieldError }) => <PersonOrPhone fieldError={fieldError} pickerName="user_id" exclude={exclude} />}
        </FormDialog>
    );
}
