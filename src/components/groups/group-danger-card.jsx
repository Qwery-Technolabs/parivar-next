import { Archive, ArchiveRestore, CirclePause, CirclePlay, Trash2 } from 'lucide-react';
import { deleteGroup, setGroupStatus } from '@/app/actions/groups';
import ActionButton from '@/components/fundraise/action-button';
import { Card } from '@/components/shell/page-header';
import { GROUP_STATUS_DOT } from '@/lib/group-roles';

/**
 * About tab → Danger zone (server component): the group's status and what each step does.
 * active ⇄ inactive (read-only discussion); archive (hidden from members) ⇄ restore; an archived
 * group can be deleted for good (app-level group managers only).
 */
export default function GroupDangerCard({ group, canDelete, t }) {
    const s = group.status;
    const btn = 'btn-secondary';
    return (
        <Card title={t('groups.danger.title')} className="border-destructive/40">
            <p className="mb-3 flex items-center gap-2 text-sm text-ink">
                <span className={`size-2.5 rounded-full ${GROUP_STATUS_DOT[s] ?? GROUP_STATUS_DOT.active}`} />
                {t('groups.danger.statusNow', { status: t(`groups.status.${s}`) })}
            </p>
            <ul className="space-y-3 text-xs text-ink-gray">
                {s !== 'archived' && (
                    <li className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 flex-1">{t('groups.danger.inactiveHint')}</span>
                        {s === 'active' ? (
                            <ActionButton action={setGroupStatus.bind(null, group.id, 'inactive')} icon={<CirclePause className="size-3.5" />} className={btn}>
                                {t('groups.danger.markInactive')}
                            </ActionButton>
                        ) : (
                            <ActionButton action={setGroupStatus.bind(null, group.id, 'active')} icon={<CirclePlay className="size-3.5" />} className={btn}>
                                {t('groups.danger.markActive')}
                            </ActionButton>
                        )}
                    </li>
                )}
                <li className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1">{t('groups.danger.archiveHint')}</span>
                    {s === 'archived' ? (
                        <ActionButton action={setGroupStatus.bind(null, group.id, 'active')} icon={<ArchiveRestore className="size-3.5" />} className={btn}>
                            {t('groups.danger.restore')}
                        </ActionButton>
                    ) : (
                        <ActionButton
                            action={setGroupStatus.bind(null, group.id, 'archived')}
                            confirm={t('groups.danger.archiveConfirm')}
                            icon={<Archive className="size-3.5" />}
                            className={btn}
                        >
                            {t('groups.danger.archive')}
                        </ActionButton>
                    )}
                </li>
                {s === 'archived' && canDelete && (
                    <li className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 flex-1">{t('groups.danger.deleteHint')}</span>
                        <ActionButton
                            action={deleteGroup.bind(null, group.id)}
                            confirm={t('groups.danger.deleteConfirm')}
                            icon={<Trash2 className="size-3.5" />}
                            className="bg-destructive text-white! hover:bg-destructive/90"
                        >
                            {t('groups.danger.delete')}
                        </ActionButton>
                    </li>
                )}
            </ul>
        </Card>
    );
}
