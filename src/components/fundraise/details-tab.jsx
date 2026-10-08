import { ChevronDown } from 'lucide-react';
import { Card } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import { localized } from '@/lib/i18n/config';
import { describeHistory, historyWhen } from './history-format';
import FundraiseDangerCard from './fundraise-danger-card';
import HoldingsCard from './holdings-card';
import PublicLinkCard from './public-link-card';
import TeamPanel, { AddTeamMemberButton } from './team-panel';
import UpdatesPanel from './updates-panel';

/** Chip label for one audience rule: "Surname: Patel", "Caste: પટેલ". */
export function audienceLabel(rule, t, locale) {
    const value =
        rule.kind === 'caste' || rule.kind === 'subcaste'
            ? localized({ name: rule.caste_name ?? rule.value, name_local: rule.caste_name_local }, 'name', locale)
            : rule.value;
    return `${t(`fundraise.audience.kinds.${rule.kind}`)}: ${value}`;
}

/**
 * About tab (server component): description, audience chips, team, earlier updates, public
 * link, history. Meetings have their own tab. Sections keep ids so old ?tab=team / updates
 * links can land on them.
 */
export default function DetailsTab({
    campaign,
    audience,
    team,
    holdings = null,
    mandal = null,
    updates,
    history,
    perms,
    userId,
    today,
    t,
    locale,
    messageCount = 0,
    canClearChat = false,
    historyCount = 0,
}) {
    const description = localized(campaign.meta, 'description', locale);
    return (
        // Side column (team, public link): a little wider on desktop. Below lg both columns dissolve
        // (contents) into one list, so History can sit just before the Danger zone on a phone (order).
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="contents lg:block lg:min-w-0 lg:space-y-4">
                {/* A Mandal: its summary and Members lead the main column (mandalAboutParts). */}
                {mandal?.main}
                {(description || audience.length > 0) && (
                    <Card title={t('fundraise.description')}>
                        {description && <p className="whitespace-pre-line text-sm text-ink break-words">{description}</p>}
                        {audience.length > 0 && (
                            <div className={description ? 'mt-3 border-t border-surface-border pt-3' : ''}>
                                <p className="mb-1.5 text-[11px] uppercase tracking-wide text-ink-gray">{t('fundraise.audience.title')}</p>
                                <div className="flex flex-wrap gap-1.5">
                                    {audience.map((a) => (
                                        <Badge key={`${a.kind}:${a.value}`} tone="navy">
                                            {audienceLabel(a, t, locale)}
                                        </Badge>
                                    ))}
                                </div>
                            </div>
                        )}
                    </Card>
                )}

                {/* Updates are now posted in the discussion ("alert everyone"); earlier ones stay here. */}
                {updates.length > 0 && (
                    <section id="updates" className="scroll-mt-4">
                        <h2 className="mb-2 text-sm font-semibold text-primary">{t('fundraise.tabs.updates')}</h2>
                        <UpdatesPanel campaignId={campaign.id} updates={updates} perms={perms} userId={userId} t={t} locale={locale} />
                    </section>
                )}

                {/* Collapsed by default (native details — no script); on a phone just above the Danger zone. */}
                <details id="history" className="group min-w-0 scroll-mt-4 rounded-lg border border-surface-border bg-white shadow-sm max-lg:order-1">
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-card-head px-3.5 py-2.5 group-open:rounded-b-none group-open:border-b group-open:border-surface-border [&::-webkit-details-marker]:hidden">
                        <span className="text-sm font-semibold text-primary">
                            {t('fundraise.history.title')}
                            {history.length > 0 && <span className="ml-1.5 text-xs font-normal text-ink-gray tabular-nums">{history.length}</span>}
                        </span>
                        <ChevronDown className="size-4 text-ink-gray transition-transform group-open:rotate-180" />
                    </summary>
                    <div className="p-4">
                        <p className="mb-3 text-xs text-ink-gray">{t('fundraise.history.hint')}</p>
                        {history.length === 0 ? (
                            <p className="text-center text-sm text-ink-gray">{t('fundraise.history.empty')}</p>
                        ) : (
                            <ol className="space-y-3">
                                {history.map((h) => {
                                    const d = describeHistory(h, t, locale);
                                    return (
                                        <li key={h.id} className="border-l-2 border-surface-border pl-3">
                                            <p className="text-sm text-ink break-words">
                                                {d.summary} <span className="text-xs text-ink-gray tabular-nums">· {historyWhen(h.created_at, locale)}</span>
                                            </p>
                                            {d.changes.map((c) => (
                                                <p key={c.label} className="text-xs break-words">
                                                    <span className="font-medium text-primary">{c.label}:</span>{' '}
                                                    <span className="text-ink-gray line-through">{c.from}</span> → <span className="text-ink">{c.to}</span>
                                                </p>
                                            ))}
                                        </li>
                                    );
                                })}
                            </ol>
                        )}
                    </div>
                </details>
            </div>

            <div className="contents lg:block lg:min-w-0 lg:space-y-4">
                {/* A Mandal: its Schedules lead the side column, above Team. */}
                {mandal?.side}
                <section id="team" className="scroll-mt-4">
                    <Card
                        title={t('fundraise.tabs.team')}
                        actions={perms.manage && <AddTeamMemberButton campaignId={campaign.id} exclude={team.map((m) => m.user_id)} />}
                    >
                        {/* My role on this fundraise (the header shows it only from sm up). */}
                        {perms.teamRole && (
                            <p className="mb-3">
                                <Badge tone="orange">
                                    {t('fundraise.yourRole')}: {perms.teamRoles.map((r) => t(`fundraise.teamRoles.${r}`)).join(', ')}
                                </Badge>
                            </p>
                        )}
                        <TeamPanel campaignId={campaign.id} team={team} canManage={perms.manage} creatorId={campaign.created_by} />
                    </Card>
                </section>
                {/* Who has money outside the treasurer: kept contributions, expenses to get back. */}
                {holdings && <HoldingsCard holdings={holdings} />}
                {/* Draws its own card, with the public switch in the header. */}
                <PublicLinkCard campaignId={campaign.id} isPublic={Boolean(campaign.is_public)} token={campaign.public_token} canManage={perms.manage} />
                {/* Danger zone (its admins): clear the discussion, pause, archive — each with a sentence and a confirmation. */}
                {(perms.manage || (canClearChat && messageCount > 0) || historyCount > 0) && (
                    <div className="min-w-0 max-lg:order-2">
                        <FundraiseDangerCard
                            campaign={campaign}
                            canManage={perms.manage}
                            messageCount={canClearChat ? messageCount : 0}
                            historyCount={historyCount}
                            t={t}
                        />
                    </div>
                )}
            </div>
        </div>
    );
}
