import { ArrowLeft, CalendarDays, HandCoins, Plus } from 'lucide-react';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import ChatPanel from '@/components/chat/chat-panel';
import MeetingsSection from '@/components/meetings/meetings-section';
import NextMeetingBanner from '@/components/meetings/next-meeting-banner';
import GroupFormDialog from '@/components/groups/group-form-dialog';
import GroupMembers from '@/components/groups/group-members';
import { Card, LinkButton } from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import WaTabs from '@/components/ui/wa-tabs';
import { canCreateFundraiseIn, canManageGroup } from '@/lib/access';
import { requireUser } from '@/lib/auth';
import { messageCount } from '@/lib/chat';
import { date, money } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { getGroup, groupFundraises, groupMembers } from '@/lib/groups';
import { sp1 } from '@/lib/url';

export async function generateMetadata({ params }) {
    const { id } = await params;
    const g = await getGroup(Number(id) || 0);
    const { locale } = await getT();
    return { title: g ? localized(g, 'name', locale) : undefined };
}

const TABS = ['discussion', 'fundraise', 'about'];

/**
 * A group, laid out like old WhatsApp: a navy header with the group's name and three tabs —
 * Discussion (default = no ?tab), Fundraises, About.
 */
export default async function GroupPage({ params, searchParams }) {
    const { id } = await params;
    const sp = await searchParams;
    const user = await requireUser();
    const group = await getGroup(Number(id) || 0);
    if (!group) notFound();
    const { t, locale } = await getT();
    const tab = TABS.includes(sp1(sp.tab)) ? sp1(sp.tab) : 'discussion';

    const [members, fundraises, canManage, canFundraise, messages] = await Promise.all([
        groupMembers(group.id),
        groupFundraises(group.id),
        canManageGroup(user, group.id),
        canCreateFundraiseIn(user, group.id),
        messageCount('group', group.id),
    ]);
    const name = localized(group, 'name', locale);
    const base = `/groups/${group.id}`;

    return (
        <div>
            <Link href="/groups" className="mb-2 inline-flex items-center gap-1 text-xs font-medium text-ink-gray hover:text-primary">
                <ArrowLeft className="size-3.5" /> {t('groups.title')}
            </Link>
            <div className="mb-3 overflow-hidden rounded-lg bg-brand-navy text-white shadow-sm">
                <div className="flex items-center gap-3 px-3 pt-3 sm:px-4">
                    <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-white/15 text-base font-semibold">
                        {name.trim().charAt(0).toUpperCase()}
                    </span>
                    <div className="min-w-0 flex-1">
                        <h1 className="truncate text-base font-semibold">{name}</h1>
                        {/* white/70 on navy: 7.34:1 */}
                        <p className="truncate text-xs text-white/70">
                            {t('groups.memberCount', { count: members.length })}
                            {fundraises.length > 0 && ` · ${t('groups.fundraiseCount', { count: fundraises.length })}`}
                        </p>
                    </div>
                    {canManage && <GroupFormDialog group={group} onNavy />}
                </div>
                <div className="mt-2">
                    <WaTabs
                        active={tab}
                        tabs={[
                            { key: 'discussion', label: t('groups.tabs.discussion'), href: base, count: messages },
                            { key: 'fundraise', label: t('groups.tabs.fundraise'), href: `${base}?tab=fundraise`, count: fundraises.length },
                            { key: 'about', label: t('groups.tabs.about'), href: `${base}?tab=about` },
                        ]}
                    />
                </div>
            </div>

            {tab === 'discussion' && (
                <>
                    <NextMeetingBanner scope="group" scopeId={group.id} href={`${base}?tab=about#meetings`} />
                    <ChatPanel scope="group" scopeId={group.id} />
                </>
            )}

            {tab === 'fundraise' && (
                <div className="theme-fundraise space-y-3">
                    {canFundraise && (
                        <div className="flex justify-end">
                            {/* A fundraise is always started from its group. */}
                            <LinkButton href={`/fundraise/new?group=${group.id}`} icon={Plus} variant="secondary">
                                {t('fundraise.add')}
                            </LinkButton>
                        </div>
                    )}
                    {fundraises.length === 0 ? (
                        <p className="rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">
                            {t('fundraise.empty')}
                        </p>
                    ) : (
                        // Chat-list look: one row per fundraise, amount where the last-message time would be.
                        <ul className="divide-y divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                            {fundraises.map((f) => (
                                <li key={f.id}>
                                    <Link href={`/fundraise/${f.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/60">
                                        <span aria-hidden className="flex size-10 shrink-0 items-center justify-center rounded-full bg-accent text-primary">
                                            <HandCoins className="size-5" />
                                        </span>
                                        <span className="min-w-0 flex-1">
                                            <span className="block truncate text-sm font-semibold text-primary">{localized(f, 'title', locale)}</span>
                                            <span className="flex items-center gap-1 truncate text-xs text-ink-gray">
                                                {f.start_date && <CalendarDays className="size-3 shrink-0" />}
                                                {f.start_date && date(f.start_date, locale)}
                                                {f.end_date && ` – ${date(f.end_date, locale)}`}
                                            </span>
                                        </span>
                                        <span className="shrink-0 text-right">
                                            <span className="block text-sm font-semibold tabular-nums text-emerald-700">{money(f.collected)}</span>
                                            <Badge status={f.status} className="mt-0.5">
                                                {t(`fundraise.${f.status}`)}
                                            </Badge>
                                        </span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    )}
                </div>
            )}

            {tab === 'about' && (
                <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,2fr)]">
                    <div id="meetings" className="scroll-mt-4 xl:col-span-2">
                        <MeetingsSection scope="group" scopeId={group.id} defaultTitle={`${name} — ${t('meetings.word')}`} />
                    </div>
                    <Card title={t('groups.about')} className="h-fit">
                        <p className="whitespace-pre-line text-sm text-ink">{group.meta.description || <span className="text-ink-gray">{t('groups.noDescription')}</span>}</p>
                        <p className="mt-3 text-xs text-ink-gray">{t('groups.createdOn', { date: date(String(group.created_at).slice(0, 10), locale) })}</p>
                    </Card>
                    <GroupMembers groupId={group.id} members={members} canManage={canManage} currentUserId={user.id} />
                </div>
            )}
        </div>
    );
}
