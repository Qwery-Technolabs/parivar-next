'use client';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { textInput } from '@/components/ui/field';
import { useT } from '@/lib/i18n/client';

const VISIBLE = 5;

/**
 * Tick one or more groups (submits `name` once per ticked group). The list shows at most
 * five rows and scrolls; past five groups a search box filters it. Ticks survive filtering —
 * hidden rows stay in the form, only out of sight.
 * `defaultValues` start ticked; `lockedValues` show ticked but cannot change (and are not
 * submitted — the server keeps what the user may not touch).
 * @param {{ groups: Array<{ value: string, label: string }>, name?: string, label?: string, hint?: string, error?: string|null, defaultValues?: string[], lockedValues?: string[] }} props
 */
export default function GroupChecklist({ groups, name = 'group_ids', label, hint, error = null, defaultValues = [], lockedValues = [] }) {
    const { t } = useT();
    const [q, setQ] = useState('');
    const needle = q.trim().toLowerCase();
    const shown = (g) => !needle || g.label.toLowerCase().includes(needle);
    const matches = groups.filter(shown).length;

    return (
        <div>
            {label && <p className="mb-1 text-xs font-medium text-ink-gray">{label}</p>}
            {groups.length > VISIBLE && (
                <div className="relative mb-1.5">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-gray" />
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        // Enter in the search box must not submit the whole dialog.
                        onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                        placeholder={t('groups.searchPlaceholder')}
                        aria-label={t('groups.searchPlaceholder')}
                        className={`${textInput()} w-full pl-8`}
                    />
                </div>
            )}
            {/* 5 rows × 2.25rem: the cap on what shows at once. */}
            <ul className="max-h-45 divide-y divide-surface-border overflow-y-auto rounded-md border border-surface-border">
                {groups.map((g) => (
                    <li key={g.value} hidden={!shown(g)}>
                        <label className="flex h-9 cursor-pointer items-center gap-2 px-3 text-sm text-primary hover:bg-accent">
                            <input
                                type="checkbox"
                                name={name}
                                value={g.value}
                                defaultChecked={defaultValues.includes(g.value) || lockedValues.includes(g.value)}
                                disabled={lockedValues.includes(g.value)}
                                className="size-4 shrink-0 accent-[var(--color-brand-orange-strong)] disabled:opacity-60"
                            />
                            <span className="truncate">{g.label}</span>
                        </label>
                    </li>
                ))}
                {matches === 0 && <li className="px-3 py-2 text-sm text-ink-gray">{t('common.noResults')}</li>}
            </ul>
            {error ? (
                <p className="mt-1 text-xs font-medium text-destructive">{error}</p>
            ) : hint ? (
                <p className="mt-1 text-xs text-ink-gray">{hint}</p>
            ) : null}
        </div>
    );
}
