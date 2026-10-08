'use client';
import { Check, ClipboardCheck, Search } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { textInput } from '@/components/ui/field';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import PendingList from './pending-list';

/**
 * One member's row — VIEW ONLY: what they owed before, came ✓ / –, what they paid and how.
 * Money and attendance are entered with "+ Contribution" (member, schedule, came, amount, mode).
 */
function SheetRow({ member, mark, owed, expected, pendingItems, hidden, t, name }) {
    const paid = Number(mark?.paid || 0);
    return (
        <li
            className={`${hidden ? 'hidden' : 'grid'} items-center gap-2 px-3 py-2 grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_4.5rem_6rem_5rem]`}
        >
            <div className="col-span-3 min-w-0 sm:col-span-1">
                <p className="truncate text-sm font-medium text-primary">{name(member)}</p>
                <p className="text-xs text-ink-gray tabular-nums">
                    {owed > 0 ? (
                        <span className="font-medium text-destructive">{t('mandal.pendingFrom', { amount: money(owed) })}</span>
                    ) : (
                        t('mandal.noPending')
                    )}
                    {expected > 0 && <> · {t('mandal.expected', { amount: money(expected) })}</>}
                </p>
                <PendingList items={pendingItems} />
            </div>
            <span className={`text-xs font-medium ${mark?.present ? 'text-emerald-700' : 'text-ink-gray'}`}>
                {mark?.present ? `✓ ${t('mandal.present')}` : `– ${t('mandal.absent')}`}
            </span>
            <span className={`text-right text-sm tabular-nums ${paid > 0 ? 'font-semibold text-income' : 'text-ink-gray'}`}>
                {paid > 0 ? money(paid) : '–'}
            </span>
            <span className="text-right text-xs text-ink-gray">{paid > 0 && mark?.mode ? t(`fundraise.modes.${mark.mode}`) : ''}</span>
        </li>
    );
}

/**
 * "Attendance & money" for one Mandal schedule — VIEW ONLY: per member, came ✓ / –, paid and mode, with
 * what they still owe from earlier schedules. Entering money / attendance is "+ Contribution".
 * `members`: [{ id, full_name, full_name_local }]; `marks`: userId → { present, paid, mode };
 * `pending`: userId → amount owed before this schedule; `pendingList`: userId → its schedules.
 */
/** `open` / `onOpenChange` (with `button={false}`): opened from elsewhere — e.g. a row's ⋮ menu. */
export default function MandalSheet({ campaignId, meeting, members, marks, pending, pendingList = {}, open: openProp, onOpenChange, button = true }) {
    const { t, locale } = useT();
    const [ownOpen, setOwnOpen] = useState(false);
    const controlled = openProp !== undefined;
    const open = controlled ? openProp : ownOpen;
    const setOpen = (v) => (controlled ? onOpenChange?.(v) : setOwnOpen(v));
    const collect = Boolean(meeting.collect);
    const each = collect ? Number(meeting.installment) || 0 : 0;
    const name = (m) => (locale !== 'en' && m.full_name_local) || m.full_name;
    // Find a member by name (English or local); non-matching rows are only hidden.
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    const matches = (m) => !needle || [m.full_name, m.full_name_local].some((n) => (n ?? '').toLowerCase().includes(needle));
    const shown = members.filter(matches).length;
    // Rows saved while it was open: totals and the schedules table catch up once, on closing.
    const close = () => {
        setOpen(false);
        setQ('');
    };
    return (
        <>
            {button && (
                <button
                    type="button"
                    onClick={() => setOpen(true)}
                    aria-label={t('mandal.sheet')}
                    title={t('mandal.sheet')}
                    className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
                >
                    <ClipboardCheck className="size-3.5" /> <span className="hidden sm:inline">{t('mandal.sheet')}</span>
                </button>
            )}
            <Dialog open={open} onOpenChange={(next) => (next ? setOpen(true) : close())}>
                <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-2xl">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">{t('mandal.sheetTitle')}</DialogTitle>
                        <DialogDescription className="text-xs text-ink-gray">
                            {[meeting.title_local && locale !== 'en' ? meeting.title_local : meeting.title, meeting.location].filter(Boolean).join(' · ')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="rounded-md bg-accent px-3 py-2 text-sm text-primary tabular-nums">
                            {collect ? t('mandal.collectingEach', { amount: money(each) }) : t('mandal.notCollecting')}
                            <span className="mt-0.5 block text-xs text-ink-gray">{t('mandal.sheetViewNote')}</span>
                        </p>
                        {members.length === 0 ? (
                            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('mandal.noMembers')}</p>
                        ) : (
                            <>
                                <div>
                                    <div className="relative">
                                        <Search aria-hidden className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-gray" />
                                        <input
                                            type="search"
                                            value={q}
                                            onChange={(e) => setQ(e.target.value)}
                                            placeholder={t('mandal.searchMember')}
                                            aria-label={t('mandal.searchMember')}
                                            className={`${textInput()} w-full pl-8`}
                                        />
                                    </div>
                                    {needle && (
                                        <p className="mt-1 text-xs text-ink-gray tabular-nums">{t('mandal.searchShown', { shown, total: members.length })}</p>
                                    )}
                                </div>
                                {/* A box of its own that scrolls, not a dialog as long as the member list. */}
                                <ul className="max-h-[50vh] divide-y divide-surface-border overflow-y-auto rounded-md border border-surface-border">
                                    {members.map((m) => {
                                        const owed = pending[m.id] ?? 0;
                                        return (
                                            <SheetRow
                                                key={m.id}
                                                member={m}
                                                mark={marks[m.id]}
                                                owed={owed}
                                                expected={each + owed}
                                                pendingItems={pendingList[m.id]}
                                                hidden={!matches(m)}
                                                t={t}
                                                name={name}
                                            />
                                        );
                                    })}
                                    {needle && shown === 0 && <li className="px-3 py-4 text-center text-sm text-ink-gray">{t('mandal.searchNone')}</li>}
                                </ul>
                            </>
                        )}
                        <div className="flex justify-end border-t border-surface-border pt-3">
                            <button
                                type="button"
                                onClick={close}
                                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                            >
                                <Check className="size-4" /> {t('common.close')}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
