'use client';
import { Archive, ArchiveRestore, CalendarClock, ExternalLink, Eye, Pencil, Trash2, Wallet } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteCampaign, setCampaignArchived } from '@/app/actions/fundraise';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

/**
 * Row kebab on the /fundraise list for project admins (fundraise managers): jump straight to
 * a tab, edit, open the public page, archive — and, once archived, restore or delete.
 * The actions re-check the role; delete is refused unless the fundraise is archived.
 * @param {{ id: number, publicToken?: string|null, isPublic?: boolean, archived?: boolean }} props
 */
export default function CampaignRowMenu({ id, publicToken, isPublic, archived = false }) {
    const { t } = useT();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    const base = `/fundraise/${id}`;
    const run = (close, fn, confirm) => {
        close();
        if (confirm && !window.confirm(confirm)) return;
        startTransition(async () => {
            const res = await fn();
            if (res?.error) toast.error(t(res.error));
            else if (res?.message) {
                toast.success(t(res.message));
                router.refresh();
            }
        });
    };
    return (
        <KebabMenu label={t('common.more')}>
            {(close) => (
                <>
                    <MenuItem icon={Eye} href={base}>
                        {t('common.open')}
                    </MenuItem>
                    <MenuItem icon={Pencil} href={`${base}/edit`}>
                        {t('common.edit')}
                    </MenuItem>
                    <MenuItem icon={Wallet} href={`${base}?tab=money`}>
                        {t('fundraise.tabs.money')}
                    </MenuItem>
                    <MenuItem icon={CalendarClock} href={`${base}?tab=meetings`}>
                        {t('fundraise.tabs.meetings')}
                    </MenuItem>
                    {isPublic && publicToken && !archived && (
                        <MenuItem icon={ExternalLink} href={`/p/${publicToken}`}>
                            {t('fundraise.publicPage')}
                        </MenuItem>
                    )}
                    <MenuSeparator />
                    {archived ? (
                        <>
                            <MenuItem icon={ArchiveRestore} disabled={pending} onClick={() => run(close, () => setCampaignArchived(id, false))}>
                                {t('fundraise.restore')}
                            </MenuItem>
                            <MenuItem
                                icon={Trash2}
                                danger
                                disabled={pending}
                                // Redirects to /fundraise on success.
                                onClick={() => run(close, () => deleteCampaign(id), t('fundraise.deleteCampaignConfirm'))}
                            >
                                {t('fundraise.deleteCampaign')}
                            </MenuItem>
                        </>
                    ) : (
                        <MenuItem
                            icon={Archive}
                            disabled={pending}
                            onClick={() => run(close, () => setCampaignArchived(id, true), t('fundraise.archiveConfirm'))}
                        >
                            {t('fundraise.archive')}
                        </MenuItem>
                    )}
                </>
            )}
        </KebabMenu>
    );
}
