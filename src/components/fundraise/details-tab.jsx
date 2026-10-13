import { Card } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import { localized } from '@/lib/i18n/config';
import FundraiseHistory from './fundraise-history';
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
    historyTotal = 0,
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

                {/* Collapsed; its lines load when opened (FundraiseHistory). On a phone just above the Danger zone. */}
                <FundraiseHistory campaignId={campaign.id} count={historyTotal} />
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
                {/* Danger zone (app-level managers and the group's admins / sub-admins — not the fundraise's creator):
                    clear the discussion, pause, archive — each with a sentence and a confirmation. */}
                {(perms.danger || (canClearChat && messageCount > 0) || historyCount > 0) && (
                    <div className="min-w-0 max-lg:order-2">
                        <FundraiseDangerCard
                            campaign={campaign}
                            canManage={perms.danger}
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
