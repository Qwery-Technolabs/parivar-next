import { money } from '@/lib/format';
import { progressPct } from '@/lib/fundraise';

/**
 * Collected / spent / balance + progress. Server component; `t` is the server translator.
 * Money colours: collected = income (blue), spent = expense (orange), negative net rose-700.
 */
export default function FundraiseSummary({ campaign, t, compact = false }) {
    const collected = Number(campaign.collected);
    const spent = Number(campaign.spent);
    const balance = collected - spent;
    const pct = progressPct(campaign);
    const pending = Number(campaign.pending ?? 0);
    const cells = [
        { label: t('fundraise.collected'), value: money(collected), tone: 'text-income' },
        { label: t('fundraise.spent'), value: money(spent), tone: 'text-expense' },
        { label: t('fundraise.balance'), value: money(balance), tone: balance < 0 ? 'text-rose-700' : 'text-primary' },
        // Target only when one is set — no "No target" box (fundraises and Mandals alike).
        Number(campaign.target_amount) > 0 && { label: t('fundraise.target'), value: money(campaign.target_amount), tone: 'text-primary' },
    ].filter(Boolean);
    return (
        <div className="space-y-3">
            {/* Phones: hidden — the navy header already shows collected / spent / balance and target %. */}
            <div className={`hidden grid-cols-2 gap-3 sm:grid ${cells.length === 4 ? 'lg:grid-cols-4' : 'sm:grid-cols-3'}`}>
                {cells.map((c) => (
                    <div key={c.label} className={`min-w-0 rounded-lg border border-surface-border bg-white shadow-sm ${compact ? 'p-3' : 'p-4'}`}>
                        <p className="text-[11px] uppercase tracking-wide text-ink-gray">{c.label}</p>
                        <p className={`mt-1 font-semibold tabular-nums break-words ${compact ? 'text-lg' : 'text-2xl'} ${c.tone}`}>{c.value}</p>
                    </div>
                ))}
            </div>
            {/* Pledged but not paid yet: shown apart, never part of "collected". */}
            {pending > 0 && (
                <p className="rounded-md bg-amber-50 px-3 py-1.5 text-sm text-amber-900">
                    {t('fundraise.pendingTotal')}: <span className="font-semibold tabular-nums">{money(pending)}</span>
                </p>
            )}
            {pct != null && (
                <div className="hidden sm:block">
                    {/* Orange is a state colour: a filled track, with the label in ink-gray beside it. */}
                    <div
                        className="h-2 overflow-hidden rounded-full bg-surface-bggray"
                        role="progressbar"
                        aria-valuenow={pct}
                        aria-valuemin={0}
                        aria-valuemax={100}
                    >
                        <div className="h-full rounded-full bg-brand-orange" style={{ width: `${pct}%` }} />
                    </div>
                    <p className="mt-1 text-xs text-ink-gray tabular-nums">{t('fundraise.progress', { pct })}</p>
                </div>
            )}
        </div>
    );
}
