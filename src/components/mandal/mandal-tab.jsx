import { ArrowLeft, FileDown, UserMinus } from 'lucide-react';
import Link from 'next/link';
import { addMandalMember, removeMandalMember } from '@/app/actions/mandal';
import ActionButton from '@/components/fundraise/action-button';
import MandalAddMember from '@/components/mandal/mandal-add-member';
import MandalSheet from '@/components/mandal/mandal-sheet';
import ScheduleActions from '@/components/mandal/schedule-actions';
import ScheduleDialog from '@/components/mandal/schedule-dialog';
import Badge from '@/components/ui/badge';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { Card } from '@/components/shell/page-header';
import { date, money } from '@/lib/format';
import { query } from '@/lib/db';
import { scheduleMoney } from '@/lib/fundraise';
import { localized } from '@/lib/i18n/config';
import { allMarks, canRunMandal, isFor, mandalMeetings, mandalMembers, pendingBefore, syncMandalMembers, unpaidBySchedule } from '@/lib/mandal';
import PendingList from '@/components/mandal/pending-list';

/**
 * A Mandal, in two places (server components), sharing one data load:
 *   mandalMoneyParts() — its Savings tab, which IS the fundraise money tab (MoneyTab): the overview's
 *                   schedules table (each date opens its own money view: ?tab=money&schedule=<id>), and
 *                   for one schedule the strip on top (back, its details, Attendance & money, PDF).
 *   mandalAboutParts() — About tab, as { main, side } that DetailsTab places INTO its own two columns
 *                   (main: the summary + Members in a fixed-height scrolling card; side: the Schedules
 *                   to create / edit / archive, above Team) — one grid, so no blank gaps between blocks.
 */
export async function mandalMoneyParts(props) {
    return buildMandal({ ...props, section: 'money' });
}

/** The About tab's Mandal blocks: { main, side } for DetailsTab's two columns. */
export async function mandalAboutParts(props) {
    return buildMandal({ ...props, section: 'about' });
}

async function buildMandal({ campaign, user, today, t, locale, section, scheduleId = null, base = '' }) {
    const installment = Number(campaign.meta?.installment) || 0;
    await syncMandalMembers(campaign);
    const [meetings, canRun, marks] = await Promise.all([mandalMeetings(campaign.id, installment), canRunMandal(user, campaign), allMarks(campaign.id)]);
    const members = await mandalMembers(campaign.id, meetings, today);
    // Amount per person is set on each schedule; the latest one is the usual amount.
    const latest = meetings[0]?.installment || installment;
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
    // Savings: each schedule's money in / out (contributions with its event_id, expenses named for it).
    const moneyBy = section === 'money' ? await scheduleMoney(campaign.id) : null;
    const scheduleOptions = meetings.map((e) => ({ value: e.id, label: `${date(e.start_date, locale)} - ${t('mandal.word')}` }));
    // The schedule money is entered for: the most recent one not archived (the "last made Mandal").
    const current = rows.find((r) => !r.e.archived) ?? null;
    // Each member's unpaid schedules (held so far), for "pending since …" under their name.
    const unpaid = Object.fromEntries(members.map((m) => [m.id, unpaidBySchedule(m, meetings, marks, { upTo: today })]));
    const sheetFor = (r) => (
        <MandalSheet
            campaignId={campaign.id}
            meeting={r.e}
            members={r.forThem}
            marks={r.sheet}
            pending={pendingBefore(r.forThem, meetings, marks, r.e.id)}
            pendingList={Object.fromEntries(r.forThem.map((m) => [m.id, unpaidBySchedule(m, meetings, marks, { before: r.e.start_date })]))}
        />
    );

    // One schedule row: date, place, amount per person, who keeps the money. Savings adds what came in
    // and the "Attendance & money" sheet; About adds edit / archive.
    const scheduleRow = ({ e, sheet, forThem, came, got }, savings) => (
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
                {savings && Object.keys(sheet).length > 0 && (
                    <p className="text-xs text-ink-gray tabular-nums">{t('mandal.cameCount', { came, total: forThem.length })}</p>
                )}
            </div>
            {savings ? (
                <>
                    <span className="shrink-0 pt-0.5 font-semibold text-income tabular-nums">{money(got)}/-</span>
                    {/* This schedule alone, as a printout / PDF. */}
                    <Link
                        href={`/fundraise/${campaign.id}/print?schedule=${e.id}`}
                        target="_blank"
                        title={t('mandal.printSchedule')}
                        aria-label={t('mandal.printSchedule')}
                        className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center rounded-md"
                    >
                        <FileDown className="size-3.5" />
                    </Link>
                    {canRun && !e.archived && sheetFor({ e, sheet, forThem })}
                </>
            ) : (
                canRun && (
                    <ScheduleActions campaignId={campaign.id} schedule={e} received={got} members={plain} defaultInstallment={latest || ''} today={today} />
                )
            )}
        </li>
    );

    if (section === 'money') {
        const at = (id) => `${base}?tab=money&schedule=${id}`;
        const pdf = (id) => (
            <Link
                href={`/fundraise/${campaign.id}/print${id ? `?schedule=${id}` : ''}`}
                target="_blank"
                title={id ? t('mandal.printSchedule') : t('mandal.printAll')}
                aria-label={id ? t('mandal.printSchedule') : t('mandal.printAll')}
                className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center rounded-md"
            >
                <FileDown className="size-3.5" />
            </Link>
        );
        // The overview's table: one row per schedule — open it to see / add its money.
        const scheduleTable = (
            <TableShell>
                <THead>
                    <Th>{t('common.date')}</Th>
                    <Th className="hidden md:table-cell">{t('fundraise.place')}</Th>
                    <Th className="hidden sm:table-cell">{t('mandal.perMeeting')}</Th>
                    <Th numeric className="hidden sm:table-cell">
                        {t('mandal.present')}
                    </Th>
                    <Th numeric>{t('fundraise.collected')}</Th>
                    <Th numeric className="hidden sm:table-cell">
                        {t('fundraise.spent')}
                    </Th>
                    <Th className="w-24" />
                </THead>
                <tbody>
                    {rows.length === 0 ? (
                        <EmptyRow colSpan={7}>{t('mandal.noSchedulesSavings')}</EmptyRow>
                    ) : (
                        rows.map((r) => {
                            const m = moneyBy.get(r.e.id) ?? { received: 0, spent: 0 };
                            return (
                                <Tr key={r.e.id} className={r.e.archived ? 'bg-surface-bggray/40' : ''}>
                                    <Td className="whitespace-nowrap">
                                        <Link href={at(r.e.id)} className="font-medium text-primary hover:underline">
                                            {date(r.e.start_date, locale)} - {t('mandal.word')}
                                        </Link>
                                        {r.e.archived && (
                                            <Badge tone="gray" className="ml-1.5 align-middle">
                                                {t('fundraise.archivedBadge')}
                                            </Badge>
                                        )}
                                        {r.e.holder && <span className="block text-xs text-ink-gray">{t('mandal.moneyWith', { name: name(r.e.holder) })}</span>}
                                    </Td>
                                    <Td className="hidden text-ink-gray md:table-cell">{r.e.location || null}</Td>
                                    <Td className="hidden whitespace-nowrap tabular-nums sm:table-cell">
                                        {r.e.collect ? money(r.e.installment) : <span className="text-ink-gray">{t('mandal.notCollecting')}</span>}
                                    </Td>
                                    <Td numeric className="hidden text-ink-gray sm:table-cell">
                                        {Object.keys(r.sheet).length ? `${r.came}/${r.forThem.length}` : '–'}
                                    </Td>
                                    <Td numeric className="font-medium text-income">
                                        {money(m.received)}
                                    </Td>
                                    <Td numeric className="hidden font-medium text-expense sm:table-cell">
                                        {money(m.spent)}
                                    </Td>
                                    <Td className="py-1">
                                        <span className="flex items-center justify-end gap-1.5">
                                            {canRun && !r.e.archived && sheetFor(r)}
                                            {pdf(r.e.id)}
                                        </span>
                                    </Td>
                                </Tr>
                            );
                        })
                    )}
                </tbody>
            </TableShell>
        );
        // One schedule open: the strip above its money view.
        const chosen = scheduleId ? (rows.find((r) => r.e.id === scheduleId) ?? null) : null;
        const banner = chosen && (
            <div className="flex flex-wrap items-center gap-3 rounded-lg border border-brand-orange/40 bg-orange-50 px-4 py-2.5 shadow-sm">
                <Link href={`${base}?tab=money`} className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline">
                    <ArrowLeft className="size-4" /> {t('mandal.allSchedules')}
                </Link>
                <div className="min-w-0 flex-1">
                    <p className="font-semibold text-primary">
                        {date(chosen.e.start_date, locale)} - {t('mandal.word')}
                        {chosen.e.archived && (
                            <Badge tone="gray" className="ml-1.5 align-middle">
                                {t('fundraise.archivedBadge')}
                            </Badge>
                        )}
                    </p>
                    <p className="text-xs text-ink-gray tabular-nums">
                        {[
                            chosen.e.location,
                            chosen.e.collect ? t('mandal.perPersonAmount', { amount: money(chosen.e.installment) }) : t('mandal.notCollecting'),
                            chosen.e.holder ? t('mandal.moneyWith', { name: name(chosen.e.holder) }) : null,
                            Object.keys(chosen.sheet).length ? t('mandal.cameCount', { came: chosen.came, total: chosen.forThem.length }) : null,
                        ]
                            .filter(Boolean)
                            .join(' · ')}
                    </p>
                </div>
                {canRun && !chosen.e.archived && sheetFor(chosen)}
                {pdf(chosen.e.id)}
            </div>
        );
        return { scheduleTable, banner, chosen: chosen?.e ?? null, scheduleOptions, money: moneyBy };
    }

    const main = (
        <>
            <div className="grid grid-cols-3 gap-2">
                {[
                    [t('mandal.members'), members.length],
                    [t('mandal.perMeeting'), money(latest)],
                    [t('mandal.totalPending'), money(totalPending)],
                ].map(([label, value]) => (
                    <div key={label} className="rounded-lg border border-surface-border bg-white px-3 py-2 shadow-sm">
                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">{label}</p>
                        <p className="text-lg font-semibold text-primary tabular-nums">{value}</p>
                    </div>
                ))}
            </div>

            {/* Members: fixed height, scrolls inside — a long list never pushes the cards below. */}
            <Card
                title={t('mandal.members')}
                bodyClass="max-h-[26rem] overflow-y-auto"
                actions={canRun && <MandalAddMember campaignId={campaign.id} action={addMandalMember} exclude={members.map((m) => m.id)} />}
            >
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
                                        {m.due > 0 ? (
                                            <span className="font-semibold text-destructive">{t('mandal.pending', { amount: money(m.due) })}</span>
                                        ) : (
                                            t('mandal.upToDate')
                                        )}
                                        {m.missed > 0 && (
                                            <>
                                                {' · '}
                                                <span className="text-amber-800">{t('mandal.missed', { count: m.missed, days: m.daysAway ?? 0 })}</span>
                                            </>
                                        )}
                                    </p>
                                    <PendingList items={unpaid[m.id]} />
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
        </>
    );
    // Schedules are made here; their money is taken on the Savings tab.
    const side = (
        <Card
            title={t('mandal.schedules')}
            bodyClass="max-h-[26rem] overflow-y-auto"
            actions={canRun && <ScheduleDialog campaignId={campaign.id} members={plain} defaultInstallment={latest || ''} today={today} />}
        >
            {meetings.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ink-gray">{t('mandal.noSchedules')}</p>
            ) : (
                <ul className="divide-y divide-surface-border">{rows.map((r) => scheduleRow(r, false))}</ul>
            )}
        </Card>
    );
    return { main, side };
}
