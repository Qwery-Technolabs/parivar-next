'use client';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Field, selectInput, textInput } from '@/components/ui/field';
import { Popover } from '@/components/ui/popover';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

/*
 * The one table toolbar: whatever the page puts on the left (a count, a heading, action
 * buttons), and on the RIGHT the search box + the Filters button that opens a draft panel
 * (DESIGN.md §6: draft → Apply, so several filters change in one navigation).
 *
 *   <FilterPopover>  the button + panel with pinned Clear / Apply — for custom panels
 *                    (the Members toolbar, whose caste pair needs its own control)
 *   <FilterBar>      a URL-backed toolbar configured with plain data, so server pages use
 *                    it directly: search param + a list of select / switch / text filters
 */

/**
 * Filters button (dot when any filter is on) and its scrolling panel with a pinned footer.
 * `onOpen` resets the draft to what is applied; `children` renders the fields.
 */
export function FilterPopover({ activeCount = 0, disabled = false, onOpen, onClear, onApply, children }) {
    const { t } = useT();
    return (
        <Popover
            // Two columns: wide enough for two selects side by side, never wider than the phone.
            width="w-[min(34rem,calc(100vw-2rem))]"
            role="dialog"
            flush
            trigger={({ open, toggle, id }) => (
                <button
                    id={id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        if (!open) onOpen?.(); // open with what is applied, not a stale draft
                        toggle();
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-label={activeCount ? `${t('common.filters')} (${activeCount})` : t('common.filters')}
                    className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md btn-secondary px-3 text-sm font-medium"
                >
                    <SlidersHorizontal className="size-4" />
                    {t('common.filters')}
                    {activeCount > 0 && <span aria-hidden className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-white" />}
                </button>
            )}
        >
            {(close) => (
                // Header and footer stay put; only the fields between them scroll.
                <div className="flex min-h-0 flex-1 flex-col">
                    {/* Tinted header: what this panel is, and a way out. */}
                    <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-border bg-card-head px-3 py-2">
                        <p className="inline-flex items-center gap-1.5 text-sm font-semibold text-primary">
                            <SlidersHorizontal className="size-4" /> {t('common.filters')}
                            {activeCount > 0 && <span className="text-xs font-medium text-ink-gray tabular-nums">({activeCount})</span>}
                        </p>
                        <button
                            type="button"
                            onClick={close}
                            aria-label={t('common.close')}
                            className="flex size-7 items-center justify-center rounded-md text-ink-gray hover:bg-white hover:text-primary"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
                        <div className="grid grid-cols-1 gap-x-3 gap-y-3 px-3 py-3 sm:grid-cols-2">{children}</div>
                    </div>
                    {/* Tinted footer: Clear / Apply always in reach. */}
                    <div className="flex shrink-0 justify-end gap-2 border-t border-surface-border bg-card-head px-3 py-2">
                        <button
                            type="button"
                            onClick={onClear}
                            className="h-8 rounded-md border border-surface-border bg-white px-3 text-sm font-medium text-primary hover:bg-accent"
                        >
                            {t('common.clear')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onApply();
                                close();
                            }}
                            className="h-8 rounded-md bg-primary px-3 text-sm font-medium text-white hover:bg-primary/90"
                        >
                            {t('common.apply')}
                        </button>
                    </div>
                </div>
            )}
        </Popover>
    );
}

/** A titled row across both columns of a filter panel, to group related filters. */
export function FilterSection({ title }) {
    return (
        <p className="col-span-full -mb-1 border-b border-surface-border pb-1 text-[11px] font-semibold tracking-wide text-ink-gray uppercase first:mt-0 not-first:mt-1">
            {title}
        </p>
    );
}

/** Search input + submit, the right-hand cluster's first half. */
export function SearchBox({ value, onChange, placeholder, disabled }) {
    const { t } = useT();
    return (
        <>
            <div className="relative min-w-32 flex-1 sm:w-64 sm:flex-none lg:w-72">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-gray" />
                <input
                    type="search"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder ?? t('common.searchPlaceholder')}
                    className={`${textInput()} w-full pl-8`}
                />
            </div>
            <button
                type="submit"
                disabled={disabled}
                aria-label={t('common.search')}
                className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90"
            >
                <Search className="size-4" />
            </button>
        </>
    );
}

/** Row layout shared by every toolbar: left content, right cluster (wraps under on phones). */
export function ToolbarRow({ left, children, className = 'mb-3' }) {
    return (
        <div className={`flex flex-wrap items-center gap-2 ${className}`}>
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">{left}</div>
            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-nowrap">{children}</div>
        </div>
    );
}

/** Push overrides into the URL (empty → removed), reset paging, keep the rest. */
export function useUrlFilters(fixed = {}) {
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();
    const navigate = (overrides) => {
        const params = new URLSearchParams(searchParams.toString());
        for (const [k, v] of Object.entries({ ...overrides, ...fixed })) {
            if (v == null || v === '' || v === false) params.delete(k);
            else params.set(k, v === true ? '1' : String(v));
        }
        params.delete('page'); // a new filter → page 1
        const qs = params.toString();
        startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    };
    return { navigate, pending, searchParams };
}

/**
 * Data-configured toolbar for server pages.
 * @param {{
 *   search?: { param?: string, placeholder?: string },
 *   filters?: Array<{ param: string, label: string, type: 'select'|'switch'|'text', options?: Array<{value: string, label: string}>,
 *                     allLabel?: string, defaultValue?: string, hint?: string, showIf?: { param: string, value?: string, not?: string, in?: string[] } }>,
 *   fixed?: Record<string, string>,   // params always written (e.g. { tab: 'donors' })
 *   left?: React.ReactNode,
 *   className?: string,
 * }} props
 * A select's `defaultValue` is what absence means (e.g. status "open"); picking it removes the param.
 */
export default function FilterBar({ search, filters = [], fixed = {}, left, className }) {
    const { t } = useT();
    const { navigate, pending, searchParams } = useUrlFilters(fixed);
    const qParam = search?.param ?? 'q';
    const applied = () =>
        Object.fromEntries(
            filters.map((f) => {
                const raw = searchParams.get(f.param);
                return [f.param, f.type === 'switch' ? raw === '1' : (raw ?? f.defaultValue ?? '')];
            }),
        );
    const cleared = () => Object.fromEntries(filters.map((f) => [f.param, f.type === 'switch' ? false : (f.defaultValue ?? '')]));
    const [draft, setDraft] = useState(applied);
    const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

    const appliedQ = searchParams.get(qParam) ?? '';
    const [q, setQ] = useState(appliedQ);
    // Follow an externally changed ?q (back button, clear) — render-time, not an effect.
    const [seenQ, setSeenQ] = useState(appliedQ);
    if (seenQ !== appliedQ) {
        setSeenQ(appliedQ);
        setQ(appliedQ);
    }

    const now = applied();
    const visible = (f, values) => {
        if (!f.showIf) return true;
        const v = values[f.showIf.param];
        if (f.showIf.in) return f.showIf.in.includes(v ?? '');
        if (f.showIf.value != null) return v === f.showIf.value;
        if (f.showIf.not != null) return v !== f.showIf.not;
        return Boolean(v);
    };
    const activeCount = filters.filter((f) => visible(f, now) && (f.type === 'switch' ? now[f.param] : now[f.param] !== (f.defaultValue ?? ''))).length;
    const toParams = (values) =>
        Object.fromEntries(
            filters.map((f) => {
                const v = values[f.param];
                if (!visible(f, values)) return [f.param, null];
                if (f.type === 'switch') return [f.param, v ? '1' : null];
                const s = String(v ?? '').trim();
                return [f.param, s === (f.defaultValue ?? '') ? null : s];
            }),
        );

    return (
        <ToolbarRow
            className={className}
            left={
                <>
                    {left}
                    {(appliedQ || activeCount > 0) && (
                        <button
                            type="button"
                            onClick={() => navigate({ ...toParams(cleared()), [qParam]: null })}
                            className="inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-gray hover:bg-accent hover:text-primary"
                        >
                            <X className="size-3.5" /> {t('common.clear')}
                        </button>
                    )}
                </>
            }
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (q.trim() !== appliedQ) navigate({ [qParam]: q.trim() });
                }}
                className={`flex w-full items-center gap-2 sm:w-auto ${pending ? 'cursor-wait opacity-70' : ''}`}
            >
                {search && <SearchBox value={q} onChange={setQ} placeholder={search.placeholder} disabled={pending} />}
                {filters.length > 0 && (
                    <FilterPopover
                        activeCount={activeCount}
                        disabled={pending}
                        onOpen={() => setDraft(applied())}
                        onClear={() => setDraft(cleared())}
                        onApply={() => navigate(toParams(draft))}
                    >
                        {filters
                            .filter((f) => visible(f, draft))
                            .map((f) =>
                                f.type === 'switch' ? (
                                    <div key={f.param} className="flex flex-col justify-end pb-1">
                                        <Switch checked={Boolean(draft[f.param])} onChange={(v) => set(f.param, v)} label={f.label} />
                                        {f.hint && <p className="mt-1 text-xs text-ink-gray">{f.hint}</p>}
                                    </div>
                                ) : f.type === 'text' ? (
                                    <Field key={f.param} label={f.label} hint={f.hint}>
                                        <input
                                            value={draft[f.param]}
                                            onChange={(e) => set(f.param, e.target.value)}
                                            placeholder={f.allLabel ?? t('common.any')}
                                            className={`${textInput()} w-full`}
                                        />
                                    </Field>
                                ) : (
                                    <Field key={f.param} label={f.label} hint={f.hint}>
                                        <select value={draft[f.param]} onChange={(e) => set(f.param, e.target.value)} className={`${selectInput()} w-full`}>
                                            {f.allLabel != null && <option value="">{f.allLabel}</option>}
                                            {(f.options ?? []).map((o) => (
                                                <option key={o.value} value={o.value}>
                                                    {o.label}
                                                </option>
                                            ))}
                                        </select>
                                    </Field>
                                ),
                            )}
                    </FilterPopover>
                )}
            </form>
        </ToolbarRow>
    );
}
