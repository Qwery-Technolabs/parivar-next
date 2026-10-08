'use client';
import { AlertCircle, Check, ClipboardCheck, Loader2, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { saveMandalContribution } from '@/app/actions/mandal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { selectInput, textInput } from '@/components/ui/field';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import PendingList from './pending-list';

// How a member paid — the contribution modes, minus "Not paid" (what is not paid stays pending).
const MODES = ['cash', 'upi', 'bank', 'cheque', 'other'];
const TYPING_PAUSE = 900; // ms after the last keystroke in "Paid" before that row saves

/**
 * One member's row — SAVES ITSELF (no Save button to forget): "Came" the moment it is ticked, the
 * mode when changed, "Paid" a moment after typing stops (and on leaving the box). Each save is that
 * member alone (saveMandalContribution, `sheet`), queued so a row never races itself; a mark shows
 * Saving… / Saved / failed. Nothing typed is lost to a closed tab or a dropped connection beyond the
 * row being typed.
 */
function SheetRow({ campaignId, meeting, member, mark, owed, expected, pendingItems, hidden, t, name }) {
    const [present, setPresent] = useState(Boolean(mark?.present));
    const [paid, setPaid] = useState(mark?.paid != null ? String(mark.paid) : '');
    const [mode, setMode] = useState(mark?.mode && MODES.includes(mark.mode) ? mark.mode : 'cash');
    const [status, setStatus] = useState('idle'); // idle | saving | saved | error
    const queue = useRef(Promise.resolve());
    const timer = useRef(null);
    const saved = useRef({ present: Boolean(mark?.present), paid: mark?.paid != null ? String(mark.paid) : '', mode });

    useEffect(() => () => clearTimeout(timer.current), []);

    function save(next) {
        const row = { present, paid, mode, ...next };
        const same = row.present === saved.current.present && row.paid.trim() === saved.current.paid.trim() && row.mode === saved.current.mode;
        if (same) return;
        queue.current = queue.current.then(async () => {
            setStatus('saving');
            const fd = new FormData();
            fd.set('campaign_id', String(campaignId));
            fd.set('event_id', String(meeting.id));
            fd.set('user_id', String(member.id));
            fd.set('present', row.present ? '1' : '0');
            fd.set('amount', row.paid.trim());
            fd.set('mode', row.mode);
            fd.set('sheet', '1');
            try {
                const res = await saveMandalContribution(null, fd);
                if (res?.ok) {
                    saved.current = { present: row.present, paid: row.paid, mode: row.mode };
                    setStatus('saved');
                } else {
                    setStatus('error');
                    toast.error(`${name(member)}: ${t(res?.error ?? Object.values(res?.fieldErrors ?? {})[0] ?? 'common.error')}`);
                }
            } catch {
                setStatus('error');
                toast.error(`${name(member)}: ${t('mandal.rowSaveFailed')}`);
            }
        });
    }

    function onPaid(value) {
        setPaid(value);
        setStatus('idle');
        clearTimeout(timer.current);
        timer.current = setTimeout(() => save({ paid: value }), TYPING_PAUSE);
    }

    return (
        <li
            className={`${hidden ? 'hidden' : 'grid'} items-center gap-2 px-3 py-2 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_1.25rem] sm:grid-cols-[minmax(0,1fr)_auto_7rem_7rem_1.25rem]`}
        >
            <div className="col-span-4 min-w-0 sm:col-span-1">
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
            <label className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
                <input
                    type="checkbox"
                    checked={present}
                    onChange={(e) => {
                        setPresent(e.target.checked);
                        save({ present: e.target.checked });
                    }}
                    className="size-4 accent-brand-orange-strong"
                />
                {t('mandal.present')}
            </label>
            <input
                type="number"
                inputMode="decimal"
                min="0"
                step="0.01"
                value={paid}
                placeholder={t('mandal.paid')}
                aria-label={`${t('mandal.paid')} — ${name(member)}`}
                onChange={(e) => onPaid(e.target.value)}
                onBlur={() => {
                    clearTimeout(timer.current);
                    save({});
                }}
                onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
                className={`${textInput(status === 'error')} w-full tabular-nums`}
            />
            <select
                value={mode}
                aria-label={`${t('fundraise.mode')} — ${name(member)}`}
                onChange={(e) => {
                    setMode(e.target.value);
                    save({ mode: e.target.value });
                }}
                className={`${selectInput()} w-full`}
            >
                {MODES.map((x) => (
                    <option key={x} value={x}>
                        {t(`fundraise.modes.${x}`)}
                    </option>
                ))}
            </select>
            <span className="flex size-5 items-center justify-center" aria-live="polite">
                {status === 'saving' && <Loader2 className="size-4 animate-spin text-ink-gray" aria-label={t('mandal.rowSaving')} />}
                {status === 'saved' && <Check className="size-4 text-emerald-600" aria-label={t('mandal.rowSaved')} />}
                {status === 'error' && <AlertCircle className="size-4 text-destructive" aria-label={t('mandal.rowSaveFailed')} />}
            </span>
        </li>
    );
}

/**
 * "Attendance & money" for one Mandal schedule: per member — came? and paid — each row saving itself
 * as it changes, so there is no Save button to forget. The schedule sets whether money is collected
 * and how much per member; each member shows what they still owe from earlier schedules (so a
 * returning member's pending amount is collected too). Closing ("Done") refreshes the page once.
 * `members`: [{ id, full_name, full_name_local }]; `marks`: userId → { present, paid, mode };
 * `pending`: userId → amount owed before this schedule; `pendingList`: userId → its schedules.
 */
export default function MandalSheet({ campaignId, meeting, members, marks, pending, pendingList = {} }) {
    const { t, locale } = useT();
    const router = useRouter();
    const [open, setOpen] = useState(false);
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
        router.refresh();
    };
    return (
        <>
            <button
                type="button"
                onClick={() => setOpen(true)}
                aria-label={t('mandal.sheet')}
                title={t('mandal.sheet')}
                className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
            >
                <ClipboardCheck className="size-3.5" /> <span className="hidden sm:inline">{t('mandal.sheet')}</span>
            </button>
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
                            <span className="mt-0.5 block text-xs text-ink-gray">{t('mandal.autoSaveNote')}</span>
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
                                                campaignId={campaignId}
                                                meeting={meeting}
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
                                <Check className="size-4" /> {t('mandal.done')}
                            </button>
                        </div>
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
