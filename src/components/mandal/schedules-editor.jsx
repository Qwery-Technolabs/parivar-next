'use client';
import { Archive, ArchiveRestore, Check, Pencil, Plus, Trash2 } from 'lucide-react';
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, selectInput, textInput } from '@/components/ui/field';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { money } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

/**
 * The Mandal form's Schedules card: one row per Mandal day ("21 Oct 2026 - Mandal"), with place,
 * amount per person and who keeps the money. Rows live in state and post WITH the campaign form
 * (sch_id[], sch_date[], sch_place[], sch_amount[], sch_holder[], sch_archived[]) — the editor
 * dialog has no <form> of its own, so nothing nests. Kebab: Edit; Archive once money came in, or
 * Delete while nothing was received; an archived row can only be restored. The server re-checks.
 * `initial`: [{ id, start_date, location, installment, holder: {id}|null, archived, received }].
 * `people`: who may keep the money — [{ id, full_name, full_name_local }].
 */
export default function SchedulesEditor({ initial = [], people = [], today }) {
    const { t, locale } = useT();
    const [rows, setRows] = useState(() =>
        initial.map((s) => ({
            key: `e${s.id}`,
            id: s.id,
            start_date: s.start_date,
            location: s.location ?? '',
            installment: String(s.installment ?? ''),
            held_by: s.holder?.id ? String(s.holder.id) : '',
            archived: Boolean(s.archived),
            received: Number(s.received) || 0,
        })),
    );
    const [editing, setEditing] = useState(null); // null = closed; { key?, ...fields }
    const [error, setError] = useState(null);
    const name = (p) => (locale !== 'en' && p.full_name_local) || p.full_name;
    const holderName = (id) => {
        const p = people.find((x) => String(x.id) === String(id));
        return p ? name(p) : null;
    };
    const fmt = (d) => {
        const [y, m, day] = String(d).split('-').map(Number);
        if (!y) return d;
        return new Intl.DateTimeFormat(locale === 'gu' ? 'gu-IN' : 'en-IN', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }).format(
            new Date(Date.UTC(y, m - 1, day)),
        );
    };
    const sorted = [...rows].sort((a, b) => b.start_date.localeCompare(a.start_date));

    const openNew = () => {
        // The last amount is the usual one.
        const last = sorted[0];
        setError(null);
        setEditing({ start_date: today, location: '', installment: last?.installment ?? '', held_by: last?.held_by ?? '' });
    };
    const save = () => {
        const amount = Number(editing.installment);
        if (!/^\d{4}-\d{2}-\d{2}$/.test(editing.start_date || '')) return setError(t('meetings.errors.date'));
        if (!Number.isFinite(amount) || amount <= 0) return setError(t('mandal.errors.amount'));
        setRows((list) =>
            editing.key
                ? list.map((r) => (r.key === editing.key ? { ...r, ...editing } : r))
                : [...list, { ...editing, key: `n${Date.now()}`, id: null, archived: false, received: 0 }],
        );
        setEditing(null);
    };
    const patch = (key, values) => setRows((list) => list.map((r) => (r.key === key ? { ...r, ...values } : r)));

    return (
        <section className="min-w-0 overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
            <div className="flex items-center justify-between gap-2 border-b border-surface-border bg-card-head px-3.5 py-1.5">
                <h2 className="text-sm font-semibold text-primary">{t('mandal.schedules')}</h2>
                <button type="button" onClick={openNew} className="btn-secondary inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium">
                    <Plus className="size-3.5" /> {t('mandal.newSchedule')}
                </button>
            </div>
            <div className="p-3.5">
                {/* What posts with the campaign form. */}
                {rows.map((r) => (
                    <span key={r.key} hidden>
                        <input type="hidden" name="sch_id" value={r.id ?? ''} />
                        <input type="hidden" name="sch_date" value={r.start_date} />
                        <input type="hidden" name="sch_place" value={r.location} />
                        <input type="hidden" name="sch_amount" value={r.installment} />
                        <input type="hidden" name="sch_holder" value={r.held_by} />
                        <input type="hidden" name="sch_archived" value={r.archived ? '1' : ''} />
                    </span>
                ))}
                <input type="hidden" name="sch_present" value="1" />

                {sorted.length === 0 ? (
                    <p className="text-sm text-ink-gray">{t('mandal.noSchedules')}</p>
                ) : (
                    <ul className="-mx-3.5 divide-y divide-surface-border border-y border-surface-border">
                        {sorted.map((r) => (
                            <li key={r.key} className={`flex items-start gap-2 px-3.5 py-2 ${r.archived ? 'bg-surface-bggray/40' : ''}`}>
                                <div className="min-w-0 flex-1">
                                    <p className="text-sm font-medium text-primary">
                                        {fmt(r.start_date)} - {t('mandal.word')}
                                        {r.archived && (
                                            <span className="ml-1.5 rounded-full bg-surface-bggray px-1.5 text-[10px] font-medium text-ink-gray">
                                                {t('fundraise.archivedBadge')}
                                            </span>
                                        )}
                                    </p>
                                    <p className="text-xs text-ink-gray tabular-nums">
                                        {[
                                            r.location,
                                            t('mandal.perPersonAmount', { amount: money(r.installment) }),
                                            r.held_by && holderName(r.held_by) ? t('mandal.moneyWith', { name: holderName(r.held_by) }) : null,
                                        ]
                                            .filter(Boolean)
                                            .join(' · ')}
                                    </p>
                                </div>
                                <span className="shrink-0 pt-0.5 text-sm font-semibold text-income tabular-nums">{money(r.received)}/-</span>
                                <KebabMenu label={t('common.more')}>
                                    {(close) =>
                                        r.archived ? (
                                            <MenuItem
                                                icon={ArchiveRestore}
                                                onClick={() => {
                                                    close();
                                                    patch(r.key, { archived: false });
                                                }}
                                            >
                                                {t('mandal.restoreSchedule')}
                                            </MenuItem>
                                        ) : (
                                            <>
                                                <MenuItem
                                                    icon={Pencil}
                                                    onClick={() => {
                                                        close();
                                                        setError(null);
                                                        setEditing({ ...r });
                                                    }}
                                                >
                                                    {t('common.edit')}
                                                </MenuItem>
                                                <MenuSeparator />
                                                {r.received > 0 ? (
                                                    <MenuItem
                                                        icon={Archive}
                                                        onClick={() => {
                                                            close();
                                                            patch(r.key, { archived: true });
                                                        }}
                                                    >
                                                        {t('mandal.archiveSchedule')}
                                                    </MenuItem>
                                                ) : (
                                                    <MenuItem
                                                        icon={Trash2}
                                                        danger
                                                        onClick={() => {
                                                            close();
                                                            setRows((list) => list.filter((x) => x.key !== r.key));
                                                        }}
                                                    >
                                                        {t('common.delete')}
                                                    </MenuItem>
                                                )}
                                            </>
                                        )
                                    }
                                </KebabMenu>
                            </li>
                        ))}
                    </ul>
                )}
                <p className="mt-2 text-xs text-ink-gray">{t('mandal.schedulesSaveHint')}</p>
            </div>

            <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
                <DialogContent focusPopup className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">
                            {editing?.key ? t('mandal.editSchedule') : t('mandal.newSchedule')}
                        </DialogTitle>
                    </DialogHeader>
                    {editing && (
                        <div className="space-y-3">
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label={t('common.date')} required>
                                    <input
                                        type="date"
                                        value={editing.start_date}
                                        onChange={(e) => setEditing((s) => ({ ...s, start_date: e.target.value }))}
                                        className={`${textInput()} w-full`}
                                    />
                                </Field>
                                <Field label={t('mandal.amountThisTime')} required>
                                    <input
                                        type="number"
                                        inputMode="decimal"
                                        min="0"
                                        step="0.01"
                                        value={editing.installment}
                                        onChange={(e) => setEditing((s) => ({ ...s, installment: e.target.value }))}
                                        className={`${textInput()} w-full tabular-nums`}
                                    />
                                </Field>
                                {/* Just text — someone's home, an office, anywhere; not kept as a place suggestion. */}
                                <Field label={t('fundraise.place')}>
                                    <input
                                        maxLength={200}
                                        value={editing.location}
                                        onChange={(e) => setEditing((s) => ({ ...s, location: e.target.value }))}
                                        className={`${textInput()} w-full`}
                                    />
                                </Field>
                                <Field label={t('mandal.moneyWithLabel')} hint={t('mandal.moneyWithHint')}>
                                    <select
                                        value={editing.held_by}
                                        onChange={(e) => setEditing((s) => ({ ...s, held_by: e.target.value }))}
                                        className={`${selectInput()} w-full`}
                                    >
                                        <option value="">{t('mandal.notSet')}</option>
                                        {people.map((p) => (
                                            <option key={p.id} value={p.id}>
                                                {name(p)}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                            {error && <p className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{error}</p>}
                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={() => setEditing(null)}
                                    className="inline-flex h-9 items-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent"
                                >
                                    {t('common.cancel')}
                                </button>
                                <button
                                    type="button"
                                    onClick={save}
                                    className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                                >
                                    <Check className="size-4" /> {t('common.done')}
                                </button>
                            </div>
                        </div>
                    )}
                </DialogContent>
            </Dialog>
        </section>
    );
}
