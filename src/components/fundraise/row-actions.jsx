'use client';
import { CheckCircle2, History, Loader2, Pencil, Trash2 } from 'lucide-react';
import { useEffect, useRef, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { deleteContribution, deleteExpense, entryHistory, markContributionPaid } from '@/app/actions/fundraise';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';
import ContributionDialog from './contribution-dialog';
import ExpenseDialog from './expense-dialog';
import { describeHistory, historyWhen } from './history-format';

/**
 * FormDialog opens only through its trigger. The row menu closes as soon as an item is
 * clicked, so the edit dialog is mounted OUTSIDE the menu with this trigger, which opens it
 * once on mount; a fresh key per click remounts it, so each Edit click opens it again.
 */
function OpenOnMount({ open }) {
    const done = useRef(false);
    useEffect(() => {
        if (done.current) return;
        done.current = true;
        open();
    }, [open]);
    return null;
}

/**
 * Kebab on a contribution / expense row: Edit and Delete for managers, History for everyone.
 * Destructive item last, after a separator (DESIGN.md §6).
 */
export default function RowActions({ kind, campaignId, row, canManage, today, allowAnonymous, categories }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    const [editKey, setEditKey] = useState(0);
    const [paidKey, setPaidKey] = useState(0);
    // A pending pledge (mode 'unpaid') can be marked paid straight from its row.
    const isPending = kind === 'contribution' && row.mode === 'unpaid';
    const [historyOpen, setHistoryOpen] = useState(false);
    const [history, setHistory] = useState(null); // null = loading

    function remove(close) {
        close();
        if (!window.confirm(t('fundraise.deleteEntryConfirm'))) return;
        startTransition(async () => {
            const fn = kind === 'expense' ? deleteExpense : deleteContribution;
            const res = await fn(campaignId, row.id);
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    }

    function showHistory(close) {
        close();
        setHistory(null);
        setHistoryOpen(true);
        startTransition(async () => {
            const res = await entryHistory(campaignId, kind, row.id);
            setHistory(res?.ok ? res.rows : []);
        });
    }

    const Editor = kind === 'expense' ? ExpenseDialog : ContributionDialog;

    return (
        <div className={pending && !historyOpen ? 'cursor-wait opacity-70' : ''}>
            <KebabMenu label={t('common.more')}>
                {(close) => (
                    <>
                        {canManage && (
                            <MenuItem
                                icon={Pencil}
                                onClick={() => {
                                    close();
                                    setEditKey((k) => k + 1);
                                }}
                            >
                                {t('common.edit')}
                            </MenuItem>
                        )}
                        {canManage && isPending && (
                            <MenuItem
                                icon={CheckCircle2}
                                onClick={() => {
                                    close();
                                    setPaidKey((k) => k + 1);
                                }}
                            >
                                {t('fundraise.markPaid')}
                            </MenuItem>
                        )}
                        <MenuItem icon={History} onClick={() => showHistory(close)}>
                            {t('fundraise.history.title')}
                        </MenuItem>
                        {canManage && (
                            <>
                                <MenuSeparator />
                                <MenuItem icon={Trash2} danger disabled={pending} onClick={() => remove(close)}>
                                    {t('common.delete')}
                                </MenuItem>
                            </>
                        )}
                    </>
                )}
            </KebabMenu>

            {canManage && editKey > 0 && (
                <Editor
                    key={editKey}
                    campaignId={campaignId}
                    today={today}
                    entry={row}
                    allowAnonymous={allowAnonymous}
                    categories={categories}
                    trigger={({ open }) => <OpenOnMount open={open} />}
                />
            )}

            {canManage && isPending && paidKey > 0 && (
                <FormDialog
                    key={paidKey}
                    title={t('fundraise.markPaid')}
                    description={row.donor_name}
                    action={markContributionPaid}
                    hidden={{ campaign_id: campaignId, contribution_id: row.id }}
                    submitIcon={CheckCircle2}
                    submitLabel={t('fundraise.markPaid')}
                    width="sm:max-w-sm"
                    trigger={({ open }) => <OpenOnMount open={open} />}
                >
                    {({ fieldError }) => (
                        <div className="grid gap-3 sm:grid-cols-2">
                            <Field label={t('fundraise.mode')} error={fieldError('mode')} required>
                                <select name="mode" defaultValue="cash" className={`${selectInput()} w-full`}>
                                    {['cash', 'upi', 'bank', 'cheque', 'other'].map((m) => (
                                        <option key={m} value={m}>
                                            {t(`fundraise.modes.${m}`)}
                                        </option>
                                    ))}
                                </select>
                            </Field>
                            <Field label={t('fundraise.paidOn')} error={fieldError('paid_on')} required>
                                <input type="date" name="paid_on" defaultValue={today} required className={`${textInput(!!fieldError('paid_on'))} w-full`} />
                            </Field>
                        </div>
                    )}
                </FormDialog>
            )}

            <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
                <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-lg">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">{t('fundraise.history.title')}</DialogTitle>
                    </DialogHeader>
                    {history === null ? (
                        <div className="flex justify-center py-6">
                            <Loader2 className="size-5 animate-spin text-ink-gray" />
                        </div>
                    ) : history.length === 0 ? (
                        <p className="py-4 text-center text-sm text-ink-gray">{t('fundraise.history.empty')}</p>
                    ) : (
                        <HistoryList rows={history} />
                    )}
                </DialogContent>
            </Dialog>
        </div>
    );
}

/** Client rendering of history rows (the Details section renders the same on the server). */
export function HistoryList({ rows }) {
    const { t, locale } = useT();
    return (
        <ol className="space-y-3">
            {rows.map((r) => {
                const d = describeHistory(r, t, locale);
                return (
                    <li key={r.id} className="border-l-2 border-surface-border pl-3">
                        <p className="text-sm text-ink">{d.summary}</p>
                        <p className="text-xs text-ink-gray tabular-nums">{historyWhen(r.created_at, locale)}</p>
                        {d.changes.length > 0 && (
                            <ul className="mt-1 space-y-0.5 text-xs">
                                {d.changes.map((c) => (
                                    <li key={c.label} className="break-words">
                                        <span className="font-medium text-primary">{c.label}:</span>{' '}
                                        <span className="text-ink-gray line-through">{c.from}</span> → <span className="text-ink">{c.to}</span>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </li>
                );
            })}
        </ol>
    );
}
