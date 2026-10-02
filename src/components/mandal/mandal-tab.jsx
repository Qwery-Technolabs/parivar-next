import { CalendarClock, UserMinus } from 'lucide-react';
import Link from 'next/link';
import { addMandalMember, removeMandalMember } from '@/app/actions/mandal';
import ActionButton from '@/components/fundraise/action-button';
import MandalAddMember from '@/components/mandal/mandal-add-member';
import MandalSheet from '@/components/mandal/mandal-sheet';
import { Card } from '@/components/shell/page-header';
import { date, money } from '@/lib/format';
import { localized } from '@/lib/i18n/config';
import { allMarks, canRunMandal, mandalMeetings, mandalMembers, pendingBefore } from '@/lib/mandal';

/**
 * The Mandal tab (server component): a summary, the members — with what each still owes and how
 * long they have been away — and the Mandal's meetings, each with its "Attendance & money" sheet.
 * Meetings themselves are scheduled from the Meetings tab.
 */
export default async function MandalTab({ campaign, user, today, t, locale }) {
    const installment = Number(campaign.meta?.installment) || 0;
    const [meetings, canRun, marks] = await Promise.all([mandalMeetings(campaign.id, installment), canRunMandal(user, campaign), allMarks(campaign.id)]);
    const members = await mandalMembers(campaign.id, meetings, today);
    const totalPending = members.reduce((s, m) => s + m.due, 0);
    const name = (p) => localized(p, 'full_name', locale);
    const plain = members.map((m) => ({ id: m.id, full_name: m.full_name, full_name_local: m.full_name_local, joined: m.joined }));

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
                                    {canRun && (
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

                <Card title={t('mandal.collection')} bodyClass="">
                    {meetings.length === 0 ? (
                        <p className="px-4 py-5 text-sm text-ink-gray">{t('mandal.noMeetings')}</p>
                    ) : (
                        <ul className="divide-y divide-surface-border">
                            {meetings.map((e) => {
                                const sheet = marks[e.id] ?? {};
                                const came = Object.values(sheet).filter((x) => x.present).length;
                                const got = Object.values(sheet).reduce((s, x) => s + Number(x.paid || 0), 0);
                                return (
                                    <li key={e.id} className="flex items-center gap-3 px-4 py-2.5">
                                        <div className="min-w-0 flex-1">
                                            <p className="truncate font-medium text-primary">{localized(e, 'title', locale)}</p>
                                            <p className="text-xs text-ink-gray tabular-nums">
                                                {[date(e.start_date, locale), e.location, e.collect ? t('mandal.collecting', { amount: money(e.installment) }) : t('mandal.notCollecting')]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </p>
                                            {Object.keys(sheet).length > 0 && (
                                                <p className="text-xs text-ink-gray tabular-nums">{t('mandal.sheetSummary', { came, total: members.length, amount: money(got) })}</p>
                                            )}
                                        </div>
                                        {canRun && (
                                            <MandalSheet
                                                campaignId={campaign.id}
                                                meeting={e}
                                                members={plain}
                                                marks={sheet}
                                                pending={pendingBefore(plain, meetings, marks, e.id)}
                                            />
                                        )}
                                    </li>
                                );
                            })}
                        </ul>
                    )}
                    <p className="border-t border-surface-border px-4 py-2 text-xs text-ink-gray">
                        <CalendarClock className="mr-1 inline size-3.5" />
                        {t('mandal.meetingsHint')}
                    </p>
                </Card>
            </div>
        </div>
    );
}
