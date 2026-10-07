'use client';
import { useState } from 'react';
import { FilterPopover, FilterSection, SearchBox, ToolbarRow, useUrlFilters } from '@/components/ui/filter-bar';
import { Field, selectInput, textInput } from '@/components/ui/field';
import Switch from '@/components/ui/switch';
import CasteSelect from './caste-select';
import { useT } from '@/lib/i18n/client';
import { BLOOD_GROUPS } from '@/lib/roles';
import { useDebouncedCallback } from '@/components/ui/use-debounce';


/**
 * design-system.md §5 "combining several controls" + §6 draft panel: one <form> so the search
 * and the filter button wrap as a unit; type → narrow → go.
 */
export default function MembersToolbar({ filters, activeCount, villages, cities = [], roles, castes, seesArchived = false }) {
    const { t } = useT();
    const { navigate, pending } = useUrlFilters();
    const [q, setQ] = useState(filters.q);
    // Search as you type: 300 ms after typing stops (Enter / the button still search at once).
    const searchLater = useDebouncedCallback((v) => {
        if (v.trim() !== filters.q) navigate({ q: v.trim() });
    });

    // Follow an externally changed ?q (back button, clear) — render-time, not an effect.
    const [seenQ, setSeenQ] = useState(filters.q);
    if (seenQ !== filters.q) {
        setSeenQ(filters.q);
        setQ(filters.q);
    }

    return (
        <ToolbarRow
            // Clear lives only inside the filter popup (its footer), never as a loose button in the toolbar.
            className=""
        >
            <form
                onSubmit={(e) => {
                    e.preventDefault();
                    searchLater.cancel();
                    if (q.trim() !== filters.q) navigate({ q: q.trim() });
                }}
                className={`flex w-full items-center gap-2 sm:w-auto ${pending ? 'cursor-wait opacity-70' : ''}`}
            >
                <SearchBox
                    value={q}
                    onChange={(v) => {
                        setQ(v);
                        searchLater(v);
                    }}
                    disabled={pending}
                />
                <FiltersPanel
                    filters={filters}
                    activeCount={activeCount}
                    villages={villages}
                    cities={cities}
                    roles={roles}
                    castes={castes}
                    onApply={navigate}
                    disabled={pending}
                />
            </form>
        </ToolbarRow>
    );
}

function FiltersPanel({ filters, activeCount, villages, cities, roles, castes, onApply, disabled }) {
    const { t } = useT();
    // Ids travel as strings in the draft so they match <option value>.
    const initial = () => ({
        ...filters,
        caste: filters.caste ? String(filters.caste) : '',
        subcaste: filters.subcaste ? String(filters.subcaste) : '',
        ageMin: filters.ageMin != null ? String(filters.ageMin) : '',
        ageMax: filters.ageMax != null ? String(filters.ageMax) : '',
    });
    const [draft, setDraft] = useState(initial);
    const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));

    return (
        <FilterPopover
            activeCount={activeCount}
            disabled={disabled}
            onOpen={() => setDraft(initial())}
            onClear={() =>
                setDraft({
                    ...filters,
                    role: '',
                    blood: '',
                    compat: false,
                    donor: false,
                    village: '',
                    city: '',
                    surname: '',
                    gender: '',
                    caste: '',
                    subcaste: '',
                    ageMin: '',
                    ageMax: '',
                    status: 'active',
                    reg: 'registered',
                })
            }
            onApply={() =>
                onApply({
                    role: draft.role,
                    blood: draft.blood,
                    compat: draft.blood && draft.compat,
                    donor: draft.donor,
                    village: draft.village,
                    city: draft.city,
                    surname: (draft.surname ?? '').trim(),
                    gender: draft.gender,
                    caste: draft.caste,
                    subcaste: draft.caste ? draft.subcaste : null,
                    age_min: draft.ageMin.trim(),
                    age_max: draft.ageMax.trim(),
                    status: draft.status === 'active' ? null : draft.status,
                    reg: draft.reg === 'registered' ? null : draft.reg,
                })
            }
        >
            <FilterSection title={t('members.filterSections.person')} />
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
            <Field label={t('members.status')}>
                <select value={draft.status} onChange={(e) => set('status', e.target.value)} className={`${selectInput()} w-full`}>
                    <option value="active">{t('status.active')}</option>
                    <option value="inactive">{t('status.inactive')}</option>
                    <option value="deceased">{t('status.deceased')}</option>
                    {/* Administrators only: archived members (the step before deleting). */}
                    {seesArchived && <option value="archived">{t('status.archived')}</option>}
                    <option value="all">{t('common.all')}</option>
                </select>
            </Field>
            <Field label={t('members.registration')}>
                <select value={draft.reg} onChange={(e) => set('reg', e.target.value)} className={`${selectInput()} w-full`}>
                    <option value="registered">{t('members.reg.registered')}</option>
                    <option value="unregistered">{t('members.reg.unregistered')}</option>
                    <option value="all">{t('common.all')}</option>
                </select>
            </Field>
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
                                    ? 'seg-active shadow-sm'
                                    : 'text-ink-gray hover:text-brand-navy'
                            }`}
                        >
                            {label}
                        </button>
                    ))}
                </div>
            </Field>
            {/* A min/max pair answers one question, so it is one Field with one label. */}
            <Field label={t('members.ageRange')}>
                <div className="flex items-center gap-2">
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        value={draft.ageMin}
                        onChange={(e) => set('ageMin', e.target.value)}
                        placeholder={t('members.ageMin')}
                        aria-label={t('members.ageMin')}
                        className={`${textInput()} w-full min-w-0 tabular-nums`}
                    />
                    <span className="shrink-0 text-ink-gray">–</span>
                    <input
                        type="number"
                        inputMode="numeric"
                        min={0}
                        max={120}
                        value={draft.ageMax}
                        onChange={(e) => set('ageMax', e.target.value)}
                        placeholder={t('members.ageMax')}
                        aria-label={t('members.ageMax')}
                        className={`${textInput()} w-full min-w-0 tabular-nums`}
                    />
                </div>
            </Field>
            <FilterSection title={t('members.filterSections.place')} />
            <Field label={t('members.city')}>
                <select value={draft.city} onChange={(e) => set('city', e.target.value)} className={`${selectInput()} w-full`}>
                    <option value="">{t('common.any')}</option>
                    {cities.map((c) => (
                        <option key={c.value} value={c.value}>
                            {c.label} ({c.count})
                        </option>
                    ))}
                </select>
            </Field>
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
            <FilterSection title={t('members.filterSections.community')} />
            <Field label={t('members.surname')}>
                <input value={draft.surname ?? ''} onChange={(e) => set('surname', e.target.value)} className={`${textInput()} w-full`} />
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
            <FilterSection title={t('members.filterSections.blood')} />
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
            <div className="flex flex-col justify-end pb-1">
                <Switch checked={draft.donor} onChange={(v) => set('donor', v)} label={t('members.donorsOnly')} />
            </div>
            {draft.blood && (
                <div className="flex flex-col justify-end pb-1">
                    <Switch checked={draft.compat} onChange={(v) => set('compat', v)} label={t('members.compatible')} />
                    <p className="mt-1 text-xs text-ink-gray">{t('members.compatibleHint')}</p>
                </div>
            )}
        </FilterPopover>
    );
}
