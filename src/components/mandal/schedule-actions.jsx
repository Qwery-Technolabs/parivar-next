'use client';
import { Archive, ArchiveRestore, Pencil, Trash2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteMandalScheduleForm, setMandalScheduleArchived } from '@/app/actions/mandal';
import FormDialog, { OpenOnMount } from '@/components/ui/form-dialog';
import Switch from '@/components/ui/switch';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';
import ScheduleDialog from './schedule-dialog';

/**
 * Kebab on a Mandal schedule: Edit (date, place, amount, who keeps the money) and Archive; an archived
 * one: Restore, or Delete permanently (only while nothing was received — with money it stays archived).
 */
export default function ScheduleActions({ campaignId, schedule, received, members, defaultInstallment, today }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    const [editKey, setEditKey] = useState(0);
    const [deleteKey, setDeleteKey] = useState(0);
    const [withHistory, setWithHistory] = useState(false);

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
                    // Two steps, like members and groups: Archive first; an archived schedule is restored or
                    // deleted for good — the delete only while no money came in (else it stays archived).
                    schedule.archived ? (
                        <>
                            <MenuItem icon={ArchiveRestore} onClick={() => run(close, () => setMandalScheduleArchived(campaignId, schedule.id, false))}>
                                {t('mandal.restoreSchedule')}
                            </MenuItem>
                            <MenuSeparator />
                            {received > 0 ? (
                                <MenuItem icon={Trash2} disabled>
                                    {t('mandal.deleteBlocked')}
                                </MenuItem>
                            ) : (
                                <MenuItem
                                    icon={Trash2}
                                    danger
                                    disabled={pending}
                                    onClick={() => {
                                        close();
                                        setWithHistory(false);
                                        setDeleteKey((k) => k + 1);
                                    }}
                                >
                                    {t('mandal.deleteSchedule')}
                                </MenuItem>
                            )}
                        </>
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
                            <MenuItem
                                icon={Archive}
                                onClick={() => run(close, () => setMandalScheduleArchived(campaignId, schedule.id, true), t('mandal.archiveScheduleConfirm'))}
                            >
                                {t('mandal.archiveSchedule')}
                            </MenuItem>
                        </>
                    )
                }
            </KebabMenu>
            {/* Delete for good — and, if asked, its history too. */}
            {deleteKey > 0 && (
                <FormDialog
                    key={deleteKey}
                    title={t('mandal.deleteScheduleTitle')}
                    description={schedule.title}
                    action={deleteMandalScheduleForm}
                    hidden={{ campaign_id: campaignId, event_id: schedule.id }}
                    submitIcon={Trash2}
                    submitVariant="danger"
                    submitLabel={t('mandal.deleteSchedule')}
                    width="sm:max-w-md"
                    trigger={({ open }) => <OpenOnMount open={open} />}
                >
                    {() => (
                        <div className="space-y-3">
                            <p className="text-sm text-ink">{t('mandal.deleteScheduleConfirm')}</p>
                            <div className="rounded-md border border-surface-border px-3 py-2.5">
                                <Switch checked={withHistory} onChange={setWithHistory} name="with_history" label={t('mandal.deleteScheduleHistory')} />
                                <p className="mt-1 text-xs text-ink-gray">{t('mandal.deleteScheduleHistoryHint')}</p>
                            </div>
                        </div>
                    )}
                </FormDialog>
            )}
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
