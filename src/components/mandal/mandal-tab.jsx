import { UserMinus } from 'lucide-react';
import Link from 'next/link';
import { addMandalMember, removeMandalMember } from '@/app/actions/mandal';
import ActionButton from '@/components/fundraise/action-button';
import MandalAddMember from '@/components/mandal/mandal-add-member';
import MandalSheet from '@/components/mandal/mandal-sheet';
import ScheduleActions from '@/components/mandal/schedule-actions';
import ScheduleDialog from '@/components/mandal/schedule-dialog';
import Badge from '@/components/ui/badge';
import { Card } from '@/components/shell/page-header';
import { date, money } from '@/lib/format';
import { query } from '@/lib/db';
import { localized } from '@/lib/i18n/config';
import { allMarks, canRunMandal, isFor, mandalMeetings, mandalMembers, pendingBefore, syncMandalMembers } from '@/lib/mandal';

/**
 * The Mandal tab (server component): a summary, the members — with what each still owes and how
 * long they have been away — and its Schedules (one per Mandal day: date, place, amount per person,
 * who keeps the money), each with its "Attendance & money" sheet; then who has the money. Income is
 * per schedule; expenses are common to the whole Mandal (Money tab).
 */
export default async function MandalTab({ campaign, user, today, t, locale }) {
    const installment = Number(campaign.meta?.installment) || 0;
    await syncMandalMembers(campaign);
    const [meetings, canRun, marks] = await Promise.all([mandalMeetings(campaign.id, installment), canRunMandal(user, campaign), allMarks(campaign.id)]);
    const members = await mandalMembers(campaign.id, meetings, today);
    // "Everyone in the group": group members come back on their own, so only people added by phone can be removed here.
    const inGroup =
        campaign.meta?.members_mode === 'all'
            ? new Set((await query('SELECT user_id FROM admin_group_members WHERE group_id = :g', { g: campaign.group_id })).map((r) => r.user_id))
            : new Set();
    const totalPending = members.reduce((s, m) => s + m.due, 0);
    const name = (p) => localized(p, 'full_name', locale);
    const plain = members.map((m) => ({ id: m.id, full_name: m.full_name, full_name_local: m.full_name_local, joined: m.joined }));
    const rows = meetings.map((e) => {
        const sheet = marks[e.id] ?? {};
        return {
            e,
            sheet,
            forThem: plain.filter((m) => isFor(e, m.id) || sheet[m.id]),
            came: Object.values(sheet).filter((x) => x.present).length,
            got: Object.values(sheet).reduce((s, x) => s + Number(x.paid || 0), 0),
        };
    });
    // Who keeps the money: each schedule's collection, added up per person ("not set" last).
    const byHolder = new Map();
    for (const r of rows) {
        if (!r.got) continue;
        const key = r.e.holder?.id ?? 0;
        const h = byHolder.get(key) ?? { key, person: r.e.holder, amount: 0 };
        h.amount += r.got;
        byHolder.set(key, h);
    }
    const holders = [...byHolder.values()].sort((x, y) => (x.key === 0) - (y.key === 0) || y.amount - x.amount);
    const collected = Number(campaign.collected) || 0;
    const spent = Number(campaign.spent) || 0;

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-3 gap-2">
                {[
                    [t('mandal.members'), members.length],
                    [t('mandal.perMeeting'), money(installment)],
                    [t('mandal.totalPending'), money(totalPending)],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-surface-border bg-white px-3 py-2 shadow-sm">
                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">{label}</p>
                        <p className="text-lg font-semibold text-primary tabular-nums">{value}</p>
                    </div>
                ))}
            </div>

            <div className="grid gap-4 lg:grid-cols-2">
                <Card title={t('mandal.members')} bodyClass="" actions={canRun && <MandalAddMember campaignId={campaign.id} action={addMandalMember} exclude={members.map((m) => m.id)} />}>
                    {members.length === 0 ? (
                        <p className="px-4 py-5 text-sm text-ink-gray">{t('mandal.noMembers')}</p>
                    ) : (
                        <ul className="divide-y divide-surface-border">
                            {members.map((m) => (
                                <li key={m.id} className="flex items-center gap-3 px-4 py-2.5">
                                    <div className="min-w-0 flex-1">
                                        <Link href={`/members/${m.id}`} className="font-medium text-primary hover:underline">
                                            {name(m)}
                                        </Link>
                                        <p className="text-xs text-ink-gray tabular-nums">
                                            {m.due > 0 ? <span className="font-semibold text-destructive">{t('mandal.pending', { amount: money(m.due) })}</span> : t('mandal.upToDate')}
                                            {m.missed > 0 && (
                                                <>
                                                    {' · '}
                                                    <span className="text-amber-800">{t('mandal.missed', { count: m.missed, days: m.daysAway ?? 0 })}</span>
                                                </>
                                            )}
                                        </p>
                                    </div>
                                    {canRun && !inGroup.has(m.id) && (
                                        <ActionButton
                                            action={removeMandalMember.bind(null, campaign.id, m.id)}
                                            confirm={t('mandal.removeConfirm', { name: name(m) })}
                                            icon={<UserMinus className="size-4" />}
                                            label={t('mandal.remove')}
                                            plain
                                            className="size-8 justify-center px-0 text-ink-gray hover:bg-destructive/10 hover:text-destructive"
                                        />
                                    )}
                                </li>
                            ))}
                        </ul>
                    )}
                </Card>

                <div className="space-y-4">
                    <Card
                        title={t('mandal.schedules')}
                        bodyClass=""
                        actions={canRun && <ScheduleDialog campaignId={campaign.id} members={plain} defaultInstallment={installment || ''} today={today} />}
                    >
                        {meetings.length === 0 ? (
                            <p className="px-4 py-5 text-sm text-ink-gray">{t('mandal.noSchedules')}</p>
                        ) : (
                            <ul className="divide-y divide-surface-border">
                                {rows.map(({ e, sheet, forThem, came, got }) => (
                                    <li key={e.id} className={`flex items-start gap-3 px-4 py-2.5 ${e.archived ? 'bg-surface-bggray/40' : ''}`}>
                                        <div className="min-w-0 flex-1">
                                            <p className="font-medium text-primary">
                                                {date(e.start_date, locale)} - {t('mandal.word')}
                                                {e.archived && (
                                                    <Badge tone="gray" className="ml-1.5 align-middle">
                                                        {t('fundraise.archivedBadge')}
                                                    </Badge>
                                                )}
                                            </p>
                                            <p className="text-xs text-ink-gray tabular-nums">
                                                {[
                                                    e.location,
                                                    e.collect ? t('mandal.perPersonAmount', { amount: money(e.installment) }) : t('mandal.notCollecting'),
                                                    e.holder ? t('mandal.moneyWith', { name: name(e.holder) }) : null,
                                                ]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </p>
                                            {Object.keys(sheet).length > 0 && (
                                                <p className="text-xs text-ink-gray tabular-nums">{t('mandal.cameCount', { came, total: forThem.length })}</p>
                                            )}
                                        </div>
                                        <span className="shrink-0 pt-0.5 font-semibold text-income tabular-nums">{money(got)}/-</span>
                                        {canRun && !e.archived && (
                                            <MandalSheet
                                                campaignId={campaign.id}
                                                meeting={e}
                                                members={forThem}
                                                marks={sheet}
                                                pending={pendingBefore(forThem, meetings, marks, e.id)}
                                            />
                                        )}
                                        {canRun && (
                                            <ScheduleActions
                                                campaignId={campaign.id}
                                                schedule={e}
                                                received={got}
                                                members={plain}
                                                defaultInstallment={installment || ''}
                                                today={today}
                                            />
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </Card>

                    {/* One Mandal, many schedules: income per schedule, expenses common (Money tab). */}
                    <Card title={t('mandal.whoHasMoney')} bodyClass="">
                        <ul className="divide-y divide-surface-border text-sm">
                            {holders.map((h) => (
                                <li key={h.key} className="flex items-center justify-between gap-3 px-4 py-2">
                                    <span className={h.person ? 'font-medium text-primary' : 'text-ink-gray'}>{h.person ? name(h.person) : t('mandal.notSet')}</span>
                                    <span className="tabular-nums text-income">{money(h.amount)}</span>
                                </li>
                            ))}
                            <li className="flex items-center justify-between gap-3 px-4 py-2">
                                <span className="text-ink-gray">{t('mandal.commonExpenses')}</span>
                                <span className="tabular-nums text-expense">− {money(spent)}</span>
                            </li>
                            <li className="flex items-center justify-between gap-3 bg-card-head px-4 py-2 font-semibold">
                                <span className="text-primary">{t('fundraise.balance')}</span>
                                <span className={`tabular-nums ${collected - spent < 0 ? 'text-rose-700' : 'text-primary'}`}>{money(collected - spent)}</span>
                            </li>
                        </ul>
                    </Card>
                </div>
            </div>
        </div>
    );
}
