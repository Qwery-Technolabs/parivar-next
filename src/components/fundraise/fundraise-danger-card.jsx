import { Archive, ArchiveRestore, CirclePause, CirclePlay } from 'lucide-react';
import { setCampaignArchived, setCampaignStatus } from '@/app/actions/fundraise';
import ClearChatRow from '@/components/chat/clear-chat-row';
import { Card } from '@/components/shell/page-header';
import { FUNDRAISE_STATUS_DOT } from '@/lib/status-dot';
import ActionButton from './action-button';

/**
 * About tab → Danger zone of a fundraise / Mandal (server component; its admins only —
 * fundraisePermissions.manage): clear the discussion (only when the viewer is an app admin / sub-admin —
 * the page passes messageCount 0 otherwise), pause ⇄ resume (status closed: everyone can
 * still read, nobody can post), archive ⇄ restore — each with a sentence and a confirmation.
 */
export default function FundraiseDangerCard({ campaign, messageCount = 0, t }) {
    const s = campaign.status;
    // Same colours as the group's danger card: pause amber, archive slate, back to active green.
    const base = 'text-white sm:px-2.5 max-sm:size-8 max-sm:justify-center max-sm:px-0';
    const tone = {
        pause: `bg-amber-700 hover:bg-amber-800 ${base}`,
        archive: `bg-slate-600 hover:bg-slate-700 ${base}`,
        active: `bg-emerald-700 hover:bg-emerald-800 ${base}`,
    };
    const text = (key) => <span className="hidden sm:inline">{t(key)}</span>;
    return (
        <Card title={t('groups.danger.title')} className="border-destructive/40">
            <p className="mb-3 flex items-center gap-2 text-sm text-ink">
                <span className={`size-2.5 rounded-full ${FUNDRAISE_STATUS_DOT[s] ?? FUNDRAISE_STATUS_DOT.draft}`} />
                {t('groups.danger.statusNow', { status: campaign.archived_at ? t('fundraise.archivedBadge') : t(`fundraise.${s}`) })}
            </p>
            <ul className="space-y-3 text-xs text-ink-gray">
                {messageCount > 0 && <ClearChatRow scope="fundraise" scopeId={campaign.id} count={messageCount} t={t} />}
                {!campaign.archived_at && s !== 'draft' && (
                    <li className="flex flex-wrap items-center justify-between gap-2">
                        <span className="min-w-0 flex-1">{t('fundraise.danger.pauseHint')}</span>
                        {s === 'active' ? (
                            <ActionButton
                                action={setCampaignStatus.bind(null, campaign.id, 'closed')}
                                confirm={t('fundraise.danger.pauseConfirm')}
                                icon={<CirclePause className="size-3.5" />}
                                plain
                                label={t('fundraise.danger.pause')}
                                className={tone.pause}
                            >
                                {text('fundraise.danger.pause')}
                            </ActionButton>
                        ) : (
                            <ActionButton
                                action={setCampaignStatus.bind(null, campaign.id, 'active')}
                                icon={<CirclePlay className="size-3.5" />}
                                plain
                                label={t('fundraise.danger.resume')}
                                className={tone.active}
                            >
                                {text('fundraise.danger.resume')}
                            </ActionButton>
                        )}
                    </li>
                )}
                <li className="flex flex-wrap items-center justify-between gap-2">
                    <span className="min-w-0 flex-1">{t('fundraise.danger.archiveHint')}</span>
                    {campaign.archived_at ? (
                        <ActionButton
                            action={setCampaignArchived.bind(null, campaign.id, false)}
                            icon={<ArchiveRestore className="size-3.5" />}
                            plain
                            label={t('fundraise.restore')}
                            className={tone.active}
                        >
                            {text('fundraise.restore')}
                        </ActionButton>
                    ) : (
                        <ActionButton
                            action={setCampaignArchived.bind(null, campaign.id, true)}
                            confirm={t('fundraise.archiveConfirm')}
                            icon={<Archive className="size-3.5" />}
                            plain
                            label={t('fundraise.archive')}
                            className={tone.archive}
                        >
                            {text('fundraise.archive')}
                        </ActionButton>
                    )}
                </li>
            </ul>
        </Card>
    );
}
