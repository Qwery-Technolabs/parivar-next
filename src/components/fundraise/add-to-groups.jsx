'use client';
import { FolderPlus } from 'lucide-react';
import { addCampaignToGroups } from '@/app/actions/fundraise';
import FormDialog from '@/components/ui/form-dialog';
import GroupChecklist from '@/components/ui/group-checklist';
import { useT } from '@/lib/i18n/client';

/**
 * "Add to group" on the fundraise header (navy): pick more groups to show the fundraise in.
 * `groups` = only those this person may add to and it is not in yet (the page works that out;
 * the action checks again). Icon only on phones, icon + text from sm.
 * @param {{ campaignId: number, groups: Array<{ value: string, label: string }> }} props
 */
export default function AddToGroups({ campaignId, groups }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('fundraise.addToGroup')}
            description={t('fundraise.addToGroupHint')}
            action={addCampaignToGroups}
            hidden={{ campaign_id: campaignId }}
            submitIcon={FolderPlus}
            submitLabel={t('common.add')}
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    aria-label={t('fundraise.addToGroup')}
                    title={t('fundraise.addToGroup')}
                    className="inline-flex size-9 shrink-0 items-center justify-center gap-2 rounded-md border border-white/20 bg-white/10 text-sm font-medium text-white hover:bg-white/20 sm:w-auto sm:px-3"
                >
                    <FolderPlus className="size-4" /> <span className="hidden sm:inline">{t('fundraise.addToGroup')}</span>
                </button>
            )}
        >
            {({ fieldError }) => <GroupChecklist name="group_ids" groups={groups} error={fieldError('group_ids')} />}
        </FormDialog>
    );
}
