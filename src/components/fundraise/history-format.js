// Pure module — used by the server Details section and the client History dialog, so a
// history row reads the same everywhere.
import { date, money } from '@/lib/format';

const FIELDS = {
    contribution: ['donor_name', 'amount', 'paid_on', 'mode', 'reference', 'is_anonymous'],
    expense: ['title', 'place', 'category', 'amount', 'spent_on', 'notes', 'bill_ref', 'paid_by_name', 'repaid'],
};

const LABEL = {
    donor_name: 'fundraise.donor',
    amount: 'fundraise.amount',
    paid_on: 'fundraise.paidOn',
    mode: 'fundraise.mode',
    reference: 'fundraise.reference',
    is_anonymous: 'fundraise.anonymousLabel',
    title: 'fundraise.expenseWhat',
    place: 'fundraise.expenseWhere',
    category: 'fundraise.category',
    spent_on: 'fundraise.spentOn',
    notes: 'common.notes',
    bill_ref: 'fundraise.billRef',
    paid_by_name: 'fundraise.paidBy',
    repaid: 'fundraise.repaid',
};

function show(field, value, t, locale) {
    if (value == null || value === '') return '—';
    if (field === 'amount') return money(value);
    if (field === 'paid_on' || field === 'spent_on') return date(String(value).slice(0, 10), locale);
    if (field === 'mode') return t(`fundraise.modes.${value}`);
    if (field === 'is_anonymous' || field === 'repaid') return Number(value) ? t('common.yes') : t('common.no');
    return String(value);
}

/**
 * @param {{ entity: 'contribution'|'expense', action: 'add'|'edit'|'delete', snapshot: object|null, actor?: string, actor_local?: string }} row
 * @returns {{ who: string, summary: string, changes: Array<{ label: string, from: string, to: string }> }}
 */
export function describeHistory(row, t, locale) {
    const s = row.snapshot ?? {};
    const who = (locale === 'gu' && row.actor_local) || row.actor || t('fundraise.history.someone');
    const amount = money(s.amount);
    const summary =
        row.entity === 'contribution'
            ? t(`fundraise.history.contribution.${row.action}`, { who, amount, name: s.donor_name ?? '—' })
            : t(`fundraise.history.expense.${row.action}`, { who, amount, name: s.title ?? '—' });

    const changes = [];
    if (row.action === 'edit' && s.before) {
        for (const f of FIELDS[row.entity] ?? []) {
            const from = s.before[f] ?? null;
            const to = s[f] ?? null;
            // Compare as display strings: 5000 and "5000.00" are the same amount.
            const a = show(f, from, t, locale);
            const b = show(f, to, t, locale);
            if (a !== b) changes.push({ label: t(LABEL[f]), from: a, to: b });
        }
    }
    return { who, summary, changes };
}

/** "29 Sep 2026 12:40" from 'YYYY-MM-DD HH:MM:SS' (already IST — the pool's session zone). */
export function historyWhen(createdAt, locale) {
    const [d, tm] = String(createdAt ?? '').split(/[ T]/);
    return `${date(d, locale)}${tm ? ` ${tm.slice(0, 5)}` : ''}`;
}
