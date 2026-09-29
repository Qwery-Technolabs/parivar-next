// Pure module — the shareable plain-text statement of a fundraise:
//
//   ₹5,100  Ramesh Patel
//   ₹2,100  Mahesh Patel
//   -----
//   Total ₹7,200
//
// Built once here so the "Copy" button and the PDF list print exactly the same lines.
import { money } from './format';

/**
 * @param {{ income?: any[], expense?: any[], title?: string, kind: 'income'|'expense'|'both' }} data
 * @param {(key: string, vars?: object) => string} t
 */
export function ledgerText({ income = [], expense = [], title = '', kind }, t) {
    const block = (rows, nameOf, heading) => {
        // Pledged-but-unpaid lines are listed but not counted.
        const total = rows.reduce((s, r) => s + (r.mode === 'unpaid' ? 0 : Number(r.amount)), 0);
        const amounts = rows.map((r) => money(r.amount));
        // Pad amounts to one width so the names line up in a monospace view.
        const width = Math.max(0, ...amounts.map((a) => a.length));
        const lines = rows.map((r, i) => `${amounts[i].padStart(width)}  ${nameOf(r)}`);
        return [heading, ...lines, '-----', `${t('common.total')} ${money(total)}`].filter((l) => l !== null).join('\n');
    };
    // Shared text respects anonymity: the name a donor asked to hide stays hidden.
    const donor = (r) => (r.is_anonymous ? t('fundraise.anonymousLabel') : r.donor_name);
    const spend = (r) => [r.title, r.place].filter(Boolean).join(' — ');

    const parts = [];
    if (title) parts.push(title);
    if (kind === 'income' || kind === 'both') parts.push(block(income, donor, kind === 'both' ? `*${t('fundraise.contributions')}*` : null));
    if (kind === 'expense' || kind === 'both') parts.push(block(expense, spend, kind === 'both' ? `*${t('fundraise.expenses')}*` : null));
    if (kind === 'both') {
        const inc = income.reduce((s, r) => s + (r.mode === 'unpaid' ? 0 : Number(r.amount)), 0);
        const exp = expense.reduce((s, r) => s + Number(r.amount), 0);
        parts.push(`${t('fundraise.balance')} ${money(inc - exp)}`);
    }
    return parts.join('\n\n');
}
