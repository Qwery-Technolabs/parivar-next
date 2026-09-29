'use client';
import { Droplet, Search, SlidersHorizontal, X } from 'lucide-react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useState, useTransition } from 'react';
import { Field, selectInput, textInput } from '@/components/ui/field';
import { Popover } from '@/components/ui/popover';
import Switch from '@/components/ui/switch';
import CasteSelect from './caste-select';
import { useT } from '@/lib/i18n/client';
import { BLOOD_GROUPS } from '@/lib/roles';

const FILTER_KEYS = ['role', 'blood', 'compat', 'donor', 'village', 'gender', 'caste', 'subcaste', 'status'];

/**
 * DESIGN.md §5 "combining several controls" + §6 draft panel: one <form> so the search
 * and the filter button wrap as a unit; type → narrow → go.
 */
export default function MembersToolbar({ filters, activeCount, villages, roles, castes }) {
    const { t } = useT();
    const router = useRouter();
    const pathname = usePathname();
    const searchParams = useSearchParams();
    const [pending, startTransition] = useTransition();
    const [q, setQ] = useState(filters.q);

    // Follow an externally changed ?q (back button, clear) — render-time, not an effect.
    const [seenQ, setSeenQ] = useState(filters.q);
    if (seenQ !== filters.q) {
        setSeenQ(filters.q);
        setQ(filters.q);
    }

    function navigate(overrides) {
        const params = new URLSearchParams(searchParams.toString());
        for (const [k, v] of Object.entries(overrides)) {
            if (v == null || v === '' || v === false) params.delete(k);
            else params.set(k, v === true ? '1' : String(v));
        }
        params.delete('page'); // a new filter → page 1
        const qs = params.toString();
        startTransition(() => router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false }));
    }

    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    if (q.trim() !== filters.q) navigate({ q: q.trim() });
                }}
                className={`flex w-full flex-wrap items-center gap-2 sm:w-auto sm:flex-nowrap ${pending ? 'cursor-wait opacity-70' : ''}`}
            >
                <div className="relative min-w-32 flex-1 sm:min-w-72">
                    <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-ink-gray" />
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={t('common.searchPlaceholder')}
                        className={`${textInput()} w-full pl-8`}
                    />
                </div>
                <FiltersPanel
                    filters={filters}
                    activeCount={activeCount}
                    villages={villages}
                    roles={roles}
                    castes={castes}
                    onApply={navigate}
                    disabled={pending}
                />
                <button
                    type="submit"
                    disabled={pending}
                    aria-label={t('common.search')}
                    className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary text-white hover:bg-primary/90"
                >
                    <Search className="size-4" />
                </button>
            </form>

            {/* Quick blood filter chips — the most-asked question of this directory. */}
            <div className="flex w-full flex-wrap items-center gap-1.5 sm:w-auto">
                <Droplet className="size-4 text-rose-700" aria-hidden />
                {BLOOD_GROUPS.map((g) => {
                    const on = filters.blood === g;
                    return (
                        <button
                            key={g}
                            type="button"
                            disabled={pending}
                            onClick={() => navigate({ blood: on ? null : g, compat: on ? null : filters.compat })}
                            aria-pressed={on}
                            className={`h-7 shrink-0 rounded-full px-2.5 text-xs font-medium tabular-nums ring-1 ring-inset ${
                                on ? 'bg-brand-orange text-brand-navy ring-brand-orange' : 'bg-brand-navy/5 text-brand-navy ring-brand-navy/20 hover:bg-accent'
                            }`}
                        >
                            {g}
                        </button>
                    );
                })}
                {(filters.q || activeCount > 0) && (
                    <button
                        type="button"
                        onClick={() => navigate(Object.fromEntries([...FILTER_KEYS, 'q'].map((k) => [k, null])))}
                        className="ml-1 inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-gray hover:bg-accent hover:text-primary"
                    >
                        <X className="size-3.5" /> {t('common.clear')}
                    </button>
                )}
            </div>
        </div>
    );
}

function FiltersPanel({ filters, activeCount, villages, roles, castes, onApply, disabled }) {
    const { t } = useT();
    // Ids travel as strings in the draft so they match <option value>.
    const initial = () => ({ ...filters, caste: filters.caste ? String(filters.caste) : '', subcaste: filters.subcaste ? String(filters.subcaste) : '' });
    const [draft, setDraft] = useState(initial);
    const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

    return (
        <Popover
            width="w-[min(20rem,calc(100vw-2rem))]"
            role="dialog"
            trigger={({ open, toggle, id }) => (
                <button
                    id={id}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                        if (!open) setDraft(initial()); // open with what is applied, not a stale draft
                        toggle();
                    }}
                    aria-haspopup="dialog"
                    aria-expanded={open}
                    aria-label={activeCount ? `${t('common.filters')} (${activeCount})` : t('common.filters')}
                    className="relative inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 text-sm font-medium text-primary hover:bg-accent"
                >
                    <SlidersHorizontal className="size-4 text-ink-gray" />
                    {t('common.filters')}
                    {activeCount > 0 && (
                        <span aria-hidden className="absolute -right-1 -top-1 size-2.5 rounded-full bg-destructive ring-2 ring-white" />
                    )}
                </button>
            )}
        >
            {(close) => (
                <div className="space-y-3 px-3 py-2">
                    <Field label={t('members.role')}>
                        <select value={draft.role} onChange={(e) => set('role', e.target.value)} className={`${selectInput()} w-full`}>
                            <option value="">{t('common.any')}</option>
                            {roles.map((r) => (
                                <option key={r.value} value={r.value}>
                                    {r.label}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <Field label={t('members.bloodGroup')}>
                        <select
                            value={draft.blood}
                            onChange={(e) => set('blood', e.target.value)}
                            className={`${selectInput()} w-full`}
                        >
                            <option value="">{t('common.any')}</option>
                            {BLOOD_GROUPS.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </Field>
                    {draft.blood && (
                        <div>
                            <Switch checked={draft.compat} onChange={(v) => set('compat', v)} label={t('members.compatible')} />
                            <p className="mt-1 text-xs text-ink-gray">{t('members.compatibleHint')}</p>
                        </div>
                    )}
                    <Switch checked={draft.donor} onChange={(v) => set('donor', v)} label={t('members.donorsOnly')} />
                    <Field label={t('members.village')}>
                        <select value={draft.village} onChange={(e) => set('village', e.target.value)} className={`${selectInput()} w-full`}>
                            <option value="">{t('common.any')}</option>
                            {villages.map((v) => (
                                <option key={v.value} value={v.value}>
                                    {v.label} ({v.count})
                                </option>
                            ))}
                        </select>
                    </Field>
                    {castes.castes.length > 0 && (
                        <CasteSelect
                            options={castes}
                            caste={draft.caste}
                            subcaste={draft.subcaste}
                            anyLabel={t('common.any')}
                            onChange={(v) => setDraft((d) => ({ ...d, ...v }))}
                        />
                    )}
                    <Field label={t('members.gender')}>
                        <div className="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
                            {[
                                ['', t('common.any')],
                                ['male', t('gender.male')],
                                ['female', t('gender.female')],
                            ].map(([v, label]) => (
                                <button
                                    key={v || 'any'}
                                    type="button"
                                    onClick={() => set('gender', v)}
                                    className={`h-8 shrink-0 rounded px-2.5 text-xs font-medium ${
                                        draft.gender === v
                                            ? 'bg-white text-brand-navy shadow-sm ring-1 ring-surface-border'
                                            : 'text-ink-gray hover:text-brand-navy'
                                    }`}
                                >
                                    {label}
                                </button>
                            ))}
                        </div>
                    </Field>
                    <Field label={t('members.status')}>
                        <select value={draft.status} onChange={(e) => set('status', e.target.value)} className={`${selectInput()} w-full`}>
                            <option value="active">{t('status.active')}</option>
                            <option value="inactive">{t('status.inactive')}</option>
                            <option value="deceased">{t('status.deceased')}</option>
                            <option value="all">{t('common.all')}</option>
                        </select>
                    </Field>
                    <div className="flex justify-end gap-2 border-t border-surface-border pt-3">
                        <button
                            type="button"
                            onClick={() =>
                                setDraft({ ...filters, role: '', blood: '', compat: false, donor: false, village: '', gender: '', caste: '', subcaste: '', status: 'active' })
                            }
                            className="h-8 rounded-md px-3 text-sm font-medium text-ink-gray hover:bg-accent hover:text-primary"
                        >
                            {t('common.clear')}
                        </button>
                        <button
                            type="button"
                            onClick={() => {
                                onApply({
                                    role: draft.role,
                                    blood: draft.blood,
                                    compat: draft.blood && draft.compat,
                                    donor: draft.donor,
                                    village: draft.village,
                                    gender: draft.gender,
                                    caste: draft.caste,
                                    subcaste: draft.caste ? draft.subcaste : null,
                                    status: draft.status === 'active' ? null : draft.status,
                                });
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
