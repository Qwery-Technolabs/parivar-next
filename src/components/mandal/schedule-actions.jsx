'use client';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteMandalSchedule, setMandalScheduleArchived } from '@/app/actions/mandal';
import { OpenOnMount } from '@/components/ui/form-dialog';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';
import ScheduleDialog from './schedule-dialog';

/**
 * Kebab on a Mandal schedule: Edit (date, place, amount, who keeps the money); then Archive once
 * money came in (closed, kept), or Delete while nothing was received (added by mistake).
 * An archived one can only be restored.
 */
export default function ScheduleActions({ campaignId, schedule, received, members, defaultInstallment, today }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    const [editKey, setEditKey] = useState(0);

    const run = (close, fn, confirmText) => {
        close();
        if (confirmText && !window.confirm(confirmText)) return;
        startTransition(async () => {
            const res = await fn();
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    };

    return (
        <div className={pending ? 'cursor-wait opacity-70' : ''}>
            <KebabMenu label={t('common.more')}>
                {(close) =>
                    schedule.archived ? (
                        <MenuItem icon={ArchiveRestore} onClick={() => run(close, () => setMandalScheduleArchived(campaignId, schedule.id, false))}>
                            {t('mandal.restoreSchedule')}
                        </MenuItem>
                    ) : (
                        <>
                            <MenuItem
                                icon={Pencil}
                                onClick={() => {
                                    close();
                                    setEditKey((k) => k + 1);
                                }}
                            >
                                {t('common.edit')}
                            </MenuItem>
                            <MenuSeparator />
                            {received > 0 ? (
                                <MenuItem
                                    icon={Archive}
                                    onClick={() => run(close, () => setMandalScheduleArchived(campaignId, schedule.id, true), t('mandal.archiveScheduleConfirm'))}
                                >
                                    {t('mandal.archiveSchedule')}
                                </MenuItem>
                            ) : (
                                <MenuItem
                                    icon={Trash2}
                                    danger
                                    disabled={pending}
                                    onClick={() => run(close, () => deleteMandalSchedule(campaignId, schedule.id), t('mandal.deleteScheduleConfirm'))}
                                >
                                    {t('common.delete')}
                                </MenuItem>
                            )}
                        </>
                    )
                }
            </KebabMenu>
            {editKey > 0 && (
                <ScheduleDialog
                    key={editKey}
                    campaignId={campaignId}
                    schedule={schedule}
                    members={members}
                    defaultInstallment={defaultInstallment}
                    today={today}
                    trigger={({ open }) => <OpenOnMount open={open} />}
                />
            )}
        </div>
    );
}
