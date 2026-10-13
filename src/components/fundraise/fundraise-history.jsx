'use client';
import { ChevronDown, Loader2 } from 'lucide-react';
import { loadFundraiseHistory } from '@/app/actions/fundraise';
import { useOnDemand } from '@/lib/client-cache';
import { useT } from '@/lib/i18n/client';
import { describeHistory, historyWhen } from './history-format';

/**
 * A fundraise's / Mandal's History (About tab), collapsed. The page carries only how many; the latest lines are
 * fetched when it is first opened (a mini loader replaces the chevron). On a phone it sits just above the Danger zone.
 * @param {{ campaignId: number, count: number }} props
 */
export default function FundraiseHistory({ campaignId, count }) {
    const { t, locale } = useT();
    // Kept in this tab for a few minutes (lib/client-cache.js); loaded ONLY when opened (no early fetch).
    // The count is in the key: a new line makes it load afresh.
    const { res, pending, load } = useOnDemand(`fhist:${campaignId}:${count}`, () => loadFundraiseHistory(campaignId));
    const rows = res?.ok ? res.rows : null; // null = not loaded yet
    const error = Boolean(res && !res.ok);
    const onToggle = (e) => {
        if (e.currentTarget.open && !res && !pending) load();
    };
    return (
        <details
            id="history"
            onToggle={onToggle}
            className="group min-w-0 scroll-mt-4 rounded-lg border border-surface-border bg-white shadow-sm max-lg:order-1"
        >
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-card-head px-3.5 py-2.5 group-open:rounded-b-none group-open:border-b group-open:border-surface-border [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-primary">
                    {t('fundraise.history.title')}
                    {count > 0 && <span className="ml-1.5 text-xs font-normal text-ink-gray tabular-nums">{count}</span>}
                </span>
                {pending ? (
                    <Loader2 className="size-4 animate-spin text-ink-gray" />
                ) : (
                    <ChevronDown className="size-4 text-ink-gray transition-transform group-open:rotate-180" />
                )}
            </summary>
            <div className="p-4">
                <p className="mb-3 text-xs text-ink-gray">{t('fundraise.history.hint')}</p>
                {error ? (
                    <p className="text-center text-sm text-destructive">{t('common.error')}</p>
                ) : rows == null ? (
                    <p className="flex justify-center text-ink-gray">
                        <Loader2 className="size-4 animate-spin" />
                    </p>
                ) : rows.length === 0 ? (
                    <p className="text-center text-sm text-ink-gray">{t('fundraise.history.empty')}</p>
                ) : (
                    <ol className="space-y-3">
                        {rows.map((h) => {
                            const d = describeHistory(h, t, locale);
                            return (
                                <li key={h.id} className="border-l-2 border-surface-border pl-3">
                                    <p className="text-sm text-ink break-words">
                                        {d.summary} <span className="text-xs text-ink-gray tabular-nums">· {historyWhen(h.created_at, locale)}</span>
                                    </p>
                                    {d.changes.map((c) => (
                                        <p key={c.label} className="text-xs break-words">
                                            <span className="font-medium text-primary">{c.label}:</span>{' '}
                                            <span className="text-ink-gray line-through">{c.from}</span> → <span className="text-ink">{c.to}</span>
                                        </p>
                                    ))}
                                </li>
                            );
                        })}
                    </ol>
                )}
            </div>
        </details>
    );
}
