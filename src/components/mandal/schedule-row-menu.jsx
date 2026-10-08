'use client';
import { Archive, ArchiveRestore, ClipboardCheck, FileDown, Pencil } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { setMandalScheduleArchived } from '@/app/actions/mandal';
import { OpenOnMount } from '@/components/ui/form-dialog';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';
import MandalSheet from './mandal-sheet';
import ScheduleDialog from './schedule-dialog';

/**
 * A schedule's ⋮ (Savings → Schedules table, and its own strip — the date opens it): Attendance & money
 * (view only), its PDF — and, for those who run the Mandal (`manage`), Edit and Archive (an archived one: Restore).
 * Deleting stays on About → Schedules. The sheet and the edit dialog live OUTSIDE the menu — a menu
 * unmounts when it closes, which would take a dialog with it — and open from the items.
 * `sheet`: the MandalSheet props; `manage`: { campaignId, schedule, members, defaultInstallment, today } | null.
 */
export default function ScheduleRowMenu({ pdfHref, sheet = null, manage = null }) {
    const { t } = useT();
    const [sheetOpen, setSheetOpen] = useState(false);
    const [editKey, setEditKey] = useState(0);
    const [pending, startTransition] = useTransition();
    const archived = Boolean(manage?.schedule.archived);

    const toggleArchive = (close) => {
        close();
        if (!archived && !window.confirm(t('mandal.archiveScheduleConfirm'))) return;
        startTransition(async () => {
            const res = await setMandalScheduleArchived(manage.campaignId, manage.schedule.id, !archived);
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    };

    return (
        <div className={pending ? 'cursor-wait opacity-70' : ''}>
            <KebabMenu label={t('common.more')}>
                {(close) => (
                    <>
                        {sheet && (
                            <MenuItem
                                icon={ClipboardCheck}
                                onClick={() => {
                                    close();
                                    setSheetOpen(true);
                                }}
                            >
                                {t('mandal.sheet')}
                            </MenuItem>
                        )}
                        <MenuItem
                            icon={FileDown}
                            onClick={() => {
                                close();
                                window.open(pdfHref, '_blank', 'noopener');
                            }}
                        >
                            {t('mandal.printSchedule')}
                        </MenuItem>
                        {manage && (
                            <>
                                <MenuSeparator />
                                {!archived && (
                                    <MenuItem
                                        icon={Pencil}
                                        onClick={() => {
                                            close();
                                            setEditKey((k) => k + 1);
                                        }}
                                    >
                                        {t('common.edit')}
                                    </MenuItem>
                                )}
                                <MenuItem icon={archived ? ArchiveRestore : Archive} disabled={pending} onClick={() => toggleArchive(close)}>
                                    {archived ? t('mandal.restoreSchedule') : t('mandal.archiveSchedule')}
                                </MenuItem>
                            </>
                        )}
                    </>
                )}
            </KebabMenu>
            {sheet && <MandalSheet {...sheet} button={false} open={sheetOpen} onOpenChange={setSheetOpen} />}
            {manage && editKey > 0 && (
                <ScheduleDialog
                    key={editKey}
                    campaignId={manage.campaignId}
                    schedule={manage.schedule}
                    members={manage.members}
                    defaultInstallment={manage.defaultInstallment}
                    today={manage.today}
                    trigger={({ open }) => <OpenOnMount open={open} />}
                />
            )}
        </div>
    );
}
