import { Card } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import { localized } from '@/lib/i18n/config';
import { describeHistory, historyWhen } from './history-format';
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
export default function DetailsTab({ campaign, audience, team, updates, history, perms, userId, today, t, locale }) {
    const description = localized(campaign.meta, 'description', locale);
    return (
        // Side column (team, public link): a little wider on desktop.
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="min-w-0 space-y-4">
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

                <section id="history" className="scroll-mt-4">
                    <h2 className="mb-2 text-sm font-semibold text-primary">{t('fundraise.history.title')}</h2>
                    <p className="-mt-1 mb-2 text-xs text-ink-gray">{t('fundraise.history.hint')}</p>
                    <div className="rounded-lg border border-surface-border bg-white p-4 shadow-sm">
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
                </section>
            </div>

            <div className="min-w-0 space-y-4">
                <section id="team" className="scroll-mt-4">
                    <Card
                        title={t('fundraise.tabs.team')}
                        actions={perms.manage && <AddTeamMemberButton campaignId={campaign.id} exclude={team.map((m) => m.user_id)} />}
                    >
                        {/* My role on this fundraise (the header shows it only from sm up). */}
                        {perms.teamRole && (
                            <p className="mb-3">
                                <Badge tone="orange">
                                    {t('fundraise.yourRole')}: {t(`fundraise.teamRoles.${perms.teamRole}`)}
                                </Badge>
                            </p>
                        )}
                        <TeamPanel campaignId={campaign.id} team={team} canManage={perms.manage} creatorId={campaign.created_by} />
                    </Card>
                </section>
                {/* Draws its own card, with the public switch in the header. */}
                <PublicLinkCard campaignId={campaign.id} isPublic={Boolean(campaign.is_public)} token={campaign.public_token} canManage={perms.manage} />
            </div>
        </div>
    );
}
