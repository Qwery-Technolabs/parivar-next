'use client';
import { ClipboardCheck, Pencil, Save, Search } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { saveMandalMeeting } from '@/app/actions/mandal';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { selectInput, textInput } from '@/components/ui/field';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import PendingList from './pending-list';

const MODES = ['cash', 'upi', 'bank', 'cheque', 'other'];

/** What a member owed before this schedule, and what is due now (the left part of every row). */
function Who({ member, owed, expected, pendingItems, t, name }) {
    return (
        <div className="col-span-3 min-w-0 sm:col-span-1">
            <p className="truncate text-sm font-medium text-primary">{name(member)}</p>
            <p className="text-xs text-ink-gray tabular-nums">
                {owed > 0 ? <span className="font-medium text-destructive">{t('mandal.pendingFrom', { amount: money(owed) })}</span> : t('mandal.noPending')}
                {expected > 0 && <> · {t('mandal.expected', { amount: money(expected) })}</>}
            </p>
            <PendingList items={pendingItems} />
        </div>
    );
}

/**
 * "Attendance & money" for one Mandal schedule. VIEW by default: per member, came ✓ / –, paid and mode,
 * with what they still owe from earlier schedules (day-to-day entry is "+ Contribution").
 * EDIT (who runs it, open schedules — the only Edit for this, nowhere else in the Mandal): the whole list
 * becomes editable — came, paid, mode — for backfilling older schedules, saved in one go (Save) through
 * saveMandalMeeting, which keeps marks, payments, keeper and schedule link in step. Cancel drops the draft.
 * `members`: [{ id, full_name, full_name_local }]; `marks`: userId → { present, paid, mode };
 * `pending`: userId → amount owed before this schedule; `pendingList`: userId → its schedules.
 * `open` / `onOpenChange` (with `button={false}`): opened from elsewhere — e.g. a row's ⋮ menu.
 */
export default function MandalSheet({
    campaignId,
    meeting,
    members,
    marks,
    pending,
    pendingList = {},
    open: openProp,
    onOpenChange,
    button = true,
    canEdit = false,
}) {
    const { t, locale } = useT();
    const router = useRouter();
    const [ownOpen, setOwnOpen] = useState(false);
    const controlled = openProp !== undefined;
    const open = controlled ? openProp : ownOpen;
    const setOpen = (v) => (controlled ? onOpenChange?.(v) : setOwnOpen(v));
    const collect = Boolean(meeting.collect);
    const each = collect ? Number(meeting.installment) || 0 : 0;
    const name = (m) => (locale !== 'en' && m.full_name_local) || m.full_name;
    // Find a member by name (English or local); non-matching rows are only hidden (still saved).
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    // Edit mode: a draft of every row, from the saved marks.
    const [draft, setDraft] = useState(null); // null = viewing
    const [saving, startSaving] = useTransition();
    const editing = draft !== null;
    // Present / absent filter (beside the search): the saved marks, or the draft while editing.
    const [who, setWho] = useState('all'); // all | present | absent
    const came = (m) => (editing ? Boolean(draft[m.id]?.present) : Boolean(marks[m.id]?.present));
    const presentCount = members.filter(came).length;
    const matches = (m) =>
        (!needle || [m.full_name, m.full_name_local].some((n) => (n ?? '').toLowerCase().includes(needle))) &&
        (who === 'all' || (who === 'present') === came(m));
    const shown = members.filter(matches).length;
    const filtered = Boolean(needle) || who !== 'all';
    const startEdit = () =>
        setDraft(
            Object.fromEntries(
                members.map((m) => {
                    const mk = marks[m.id];
                    return [
                        m.id,
                        { present: Boolean(mk?.present), paid: mk?.paid != null ? String(mk.paid) : '', mode: MODES.includes(mk?.mode) ? mk.mode : 'cash' },
                    ];
                }),
            ),
        );
    const setRow = (id, patch) => setDraft((d) => ({ ...d, [id]: { ...d[id], ...patch } }));
    const close = () => {
        setOpen(false);
        setQ('');
        setWho('all');
        setDraft(null);
    };
    const save = () =>
        startSaving(async () => {
            const fd = new FormData();
            fd.set('campaign_id', String(campaignId));
            fd.set('event_id', String(meeting.id));
            for (const m of members) {
                const r = draft[m.id];
                fd.set(`present_${m.id}`, r.present ? '1' : '0');
                fd.set(`paid_${m.id}`, r.paid.trim());
                fd.set(`mode_${m.id}`, r.mode);
            }
            const res = await saveMandalMeeting(null, fd);
            if (res?.ok) {
                toast.success(t(res.message));
                setDraft(null);
                router.refresh();
            } else {
                const bad = res?.fieldErrors ? Object.keys(res.fieldErrors) : [];
                const who = bad.length ? members.find((m) => `paid_${m.id}` === bad[0]) : null;
                toast.error(who ? `${name(who)}: ${t(res.fieldErrors[bad[0]])}` : t(res?.error ?? 'common.error'));
            }
        });

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
                    {/* The one Edit for attendance & money (whole list, for backfilling): top right, left of ×. */}
                    {canEdit && !editing && members.length > 0 && (
                        // Icon only, like the × beside it — a blue pencil; "Edit" is its tooltip / screen-reader name.
                        <button
                            type="button"
                            onClick={startEdit}
                            aria-label={t('common.edit')}
                            title={t('common.edit')}
                            className="absolute right-10 top-2 inline-flex size-7 items-center justify-center rounded-md text-income hover:bg-accent"
                        >
                            <Pencil className="size-4" />
                        </button>
                    )}
                    <DialogHeader className={canEdit && !editing ? 'pr-14' : ''}>
                        <DialogTitle className="text-base font-semibold text-primary">{t('mandal.sheetTitle')}</DialogTitle>
                        <DialogDescription className="text-xs text-ink-gray">
                            {[meeting.title_local && locale !== 'en' ? meeting.title_local : meeting.title, meeting.location].filter(Boolean).join(' · ')}
                        </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-3">
                        <p className="rounded-md bg-accent px-3 py-2 text-sm text-primary tabular-nums">
                            {collect ? t('mandal.collectingEach', { amount: money(each) }) : t('mandal.notCollecting')}
                        </p>
                        {members.length === 0 ? (
                            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('mandal.noMembers')}</p>
                        ) : (
                            <>
                                <div className="flex items-start gap-2">
                                    <div className="min-w-0 flex-1">
                                        <div className="relative">
                                            <Search
                                                aria-hidden
                                                className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-gray"
                                            />
                                            <input
                                                type="search"
                                                value={q}
                                                onChange={(e) => setQ(e.target.value)}
                                                placeholder={t('mandal.searchMember')}
                                                aria-label={t('mandal.searchMember')}
                                                className={`${textInput()} w-full pl-8`}
                                            />
                                        </div>
                                        {filtered && (
                                            <p className="mt-1 text-xs text-ink-gray tabular-nums">
                                                {t('mandal.searchShown', { shown, total: members.length })}
                                            </p>
                                        )}
                                    </div>
                                    {/* Present / absent only (with counts) — combines with the search. */}
                                    <select
                                        value={who}
                                        onChange={(e) => setWho(e.target.value)}
                                        aria-label={t('mandal.attendanceFilter')}
                                        className={`${selectInput()} w-36 shrink-0`}
                                    >
                                        <option value="all">{t('mandal.filterAll', { count: members.length })}</option>
                                        <option value="present">{t('mandal.filterPresent', { count: presentCount })}</option>
                                        <option value="absent">{t('mandal.filterAbsent', { count: members.length - presentCount })}</option>
                                    </select>
                                </div>
                                {editing && <p className="text-xs text-amber-800">{t('mandal.sheetEditing')}</p>}
                                {/* A box of its own that scrolls, not a dialog as long as the member list. */}
                                <ul className="max-h-[50vh] divide-y divide-surface-border overflow-y-auto rounded-md border border-surface-border">
                                    {members.map((m) => {
                                        const owed = pending[m.id] ?? 0;
                                        const who = <Who member={m} owed={owed} expected={each + owed} pendingItems={pendingList[m.id]} t={t} name={name} />;
                                        const hide = !matches(m);
                                        if (editing) {
                                            const r = draft[m.id];
                                            return (
                                                <li
                                                    key={m.id}
                                                    className={`${hide ? 'hidden' : 'grid'} items-center gap-2 px-3 py-2 grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)] sm:grid-cols-[minmax(0,1fr)_auto_7rem_7rem]`}
                                                >
                                                    {who}
                                                    <label className="inline-flex items-center gap-1.5 text-xs font-medium text-ink">
                                                        <input
                                                            type="checkbox"
                                                            checked={r.present}
                                                            onChange={(e) => setRow(m.id, { present: e.target.checked })}
                                                            className="size-4 accent-brand-orange-strong"
                                                        />
                                                        {t('mandal.present')}
                                                    </label>
                                                    <input
                                                        type="number"
                                                        inputMode="decimal"
                                                        min="0"
                                                        step="0.01"
                                                        value={r.paid}
                                                        placeholder={t('mandal.paid')}
                                                        aria-label={`${t('mandal.paid')} — ${name(m)}`}
                                                        onChange={(e) => setRow(m.id, { paid: e.target.value })}
                                                        className={`${textInput()} w-full tabular-nums`}
                                                    />
                                                    <select
                                                        value={r.mode}
                                                        aria-label={`${t('fundraise.mode')} — ${name(m)}`}
                                                        onChange={(e) => setRow(m.id, { mode: e.target.value })}
                                                        className={`${selectInput()} w-full`}
                                                    >
                                                        {MODES.map((x) => (
                                                            <option key={x} value={x}>
                                                                {t(`fundraise.modes.${x}`)}
                                                            </option>
                                                        ))}
                                                    </select>
                                                </li>
                                            );
                                        }
                                        const mk = marks[m.id];
                                        const paid = Number(mk?.paid || 0);
                                        return (
                                            <li
                                                key={m.id}
                                                className={`${hide ? 'hidden' : 'grid'} items-center gap-2 px-3 py-2 grid-cols-[minmax(0,1fr)_auto_auto] sm:grid-cols-[minmax(0,1fr)_4.5rem_6rem_5rem]`}
                                            >
                                                {who}
                                                <span className={`text-xs font-medium ${mk?.present ? 'text-emerald-700' : 'text-ink-gray'}`}>
                                                    {mk?.present ? `✓ ${t('mandal.present')}` : `– ${t('mandal.absent')}`}
                                                </span>
                                                <span className={`text-right text-sm tabular-nums ${paid > 0 ? 'font-semibold text-income' : 'text-ink-gray'}`}>
                                                    {paid > 0 ? money(paid) : '–'}
                                                </span>
                                                <span className="text-right text-xs text-ink-gray">
                                                    {paid > 0 && mk?.mode ? t(`fundraise.modes.${mk.mode}`) : ''}
                                                </span>
                                            </li>
                                        );
                                    })}
                                    {filtered && shown === 0 && <li className="px-3 py-4 text-center text-sm text-ink-gray">{t('mandal.searchNone')}</li>}
                                </ul>
                                {editing && (
                                    <div className="flex justify-end gap-2 border-t border-surface-border pt-3">
                                        <button
                                            type="button"
                                            onClick={() => setDraft(null)}
                                            disabled={saving}
                                            className="inline-flex h-9 items-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent disabled:opacity-60"
                                        >
                                            {t('common.cancel')}
                                        </button>
                                        <button
                                            type="button"
                                            onClick={save}
                                            disabled={saving}
                                            className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-60"
                                        >
                                            <Save className="size-4" /> {saving ? t('common.saving') : t('common.save')}
                                        </button>
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                </DialogContent>
            </Dialog>
        </>
    );
}
