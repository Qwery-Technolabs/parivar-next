'use client';
import { Plus, X } from 'lucide-react';
import { useState } from 'react';
import { selectInput, textInput } from '@/components/ui/field';
import TagSelect from '@/components/ui/tag-select';
import { useT } from '@/lib/i18n/client';

// Surname has its own multi-select above the rows; the rows cover the other kinds.
const ROW_KINDS = ['caste', 'subcaste', 'city', 'village'];

/**
 * "Who should see this first".
 *   - Surnames: one multi-select (chips), posted as audience_surname[] — one row each.
 *   - Other rules: rows of [kind | value], posted as parallel audience_kind[] / audience_value[].
 *     Caste / sub-caste pick from the castes tree (value = admin_castes id); current city and
 *     native village are free text with suggestions.
 *
 * @param {{
 *   defaultRows?: Array<{kind: string, value: string}>,
 *   castes: { castes: Array<{value: string, label: string}>, subcastes: Record<string, Array<{value: string, label: string}>> },
 *   suggestions: { surname: Array<{value: string, label: string, count: number}>, city: string[], village: string[] },
 *   error?: string|null,
 * }} props
 */
export default function AudienceEditor({ defaultRows = [], castes, suggestions, error }) {
    const { t } = useT();
    const [surnames, setSurnames] = useState(() => defaultRows.filter((r) => r.kind === 'surname').map((r) => r.value));
    // Keys come from a counter kept in state, so a removed row never hands its key to another.
    const [state, setState] = useState(() => {
        const rows = defaultRows.filter((r) => r.kind !== 'surname').map((r, i) => ({ ...r, key: i }));
        return { rows, next: rows.length };
    });
    const rows = state.rows;

    const update = (key, patch) => setState((s) => ({ ...s, rows: s.rows.map((r) => (r.key === key ? { ...r, ...patch } : r)) }));
    const add = () => setState((s) => ({ rows: [...s.rows, { kind: 'city', value: '', key: s.next }], next: s.next + 1 }));
    const remove = (key) => setState((s) => ({ ...s, rows: s.rows.filter((r) => r.key !== key) }));

    const casteLabel = (id) => castes.castes.find((c) => c.value === id)?.label ?? id;

    return (
        <fieldset className="min-w-0 space-y-3 rounded-lg border border-surface-border p-3">
            <legend className="px-1 text-xs font-medium text-ink-gray">{t('fundraise.audience.title')}</legend>
            <p className="text-xs text-ink-gray">{t('fundraise.audience.hint')}</p>

            {/* Not <Field>: that is a <label>, and a click anywhere in a label activates its first
                button — here a chip's remove button, which would delete a surname. */}
            <div className="min-w-0">
                <span className="mb-1 block text-xs font-medium text-ink-gray">{t('fundraise.audience.kinds.surname')}</span>
                <TagSelect
                    name="audience_surname"
                    options={suggestions.surname}
                    value={surnames}
                    onChange={setSurnames}
                    allowCustom
                    max={30}
                    label={t('fundraise.audience.kinds.surname')}
                    placeholder={t('fundraise.audience.surnamePlaceholder')}
                    emptyText={t('fundraise.audience.surnameEmpty')}
                    addLabel={(q) => t('fundraise.audience.addSurname', { name: q })}
                />
                <span className="mt-1 block text-xs text-ink-gray">{t('fundraise.audience.surnameHint')}</span>
            </div>

            {rows.map((r) => (
                <div key={r.key} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                    <select
                        name="audience_kind"
                        value={r.kind}
                        // Switching between a caste kind and a text kind makes the old value meaningless.
                        onChange={(e) => update(r.key, { kind: e.target.value, value: '' })}
                        aria-label={t('fundraise.audience.kind')}
                        className={`${selectInput()} w-full shrink-0 sm:w-44`}
                    >
                        {ROW_KINDS.map((k) => (
                            <option key={k} value={k}>
                                {t(`fundraise.audience.kinds.${k}`)}
                            </option>
                        ))}
                    </select>
                    <div className="flex min-w-0 flex-1 items-center gap-2">
                        <div className="relative min-w-0 flex-1">
                            {r.kind === 'caste' ? (
                                <select
                                    name="audience_value"
                                    value={r.value}
                                    onChange={(e) => update(r.key, { value: e.target.value })}
                                    aria-label={t('fundraise.audience.value')}
                                    className={`${selectInput(!!error && !r.value)} w-full`}
                                >
                                    <option value="">{t('fundraise.audience.choose')}</option>
                                    {castes.castes.map((c) => (
                                        <option key={c.value} value={c.value}>
                                            {c.label}
                                        </option>
                                    ))}
                                </select>
                            ) : r.kind === 'subcaste' ? (
                                <select
                                    name="audience_value"
                                    value={r.value}
                                    onChange={(e) => update(r.key, { value: e.target.value })}
                                    aria-label={t('fundraise.audience.value')}
                                    className={`${selectInput(!!error && !r.value)} w-full`}
                                >
                                    <option value="">{t('fundraise.audience.choose')}</option>
                                    {/* Grouped by caste: two sub-castes may share a name under different castes. */}
                                    {Object.entries(castes.subcastes)
                                        .filter(([, subs]) => subs.length)
                                        .map(([casteId, subs]) => (
                                            <optgroup key={casteId} label={casteLabel(casteId)}>
                                                {subs.map((s) => (
                                                    <option key={s.value} value={s.value}>
                                                        {s.label}
                                                    </option>
                                                ))}
                                            </optgroup>
                                        ))}
                                </select>
                            ) : (
                                <input
                                    name="audience_value"
                                    value={r.value}
                                    onChange={(e) => update(r.key, { value: e.target.value })}
                                    list={`audience-${r.kind}`}
                                    maxLength={150}
                                    aria-label={t('fundraise.audience.value')}
                                    className={`${textInput()} w-full`}
                                />
                            )}
                        </div>
                        <button
                            type="button"
                            onClick={() => remove(r.key)}
                            aria-label={t('fundraise.audience.remove')}
                            className="flex size-9 shrink-0 items-center justify-center rounded-md text-ink-gray hover:bg-destructive/10 hover:text-destructive"
                        >
                            <X className="size-4" />
                        </button>
                    </div>
                </div>
            ))}

            {error && <p className="text-xs font-medium text-destructive">{error}</p>}

            <button
                type="button"
                onClick={add}
                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-surface-border bg-white px-2.5 text-xs font-medium text-primary hover:bg-accent"
            >
                <Plus className="size-3.5" /> {t('fundraise.audience.add')}
            </button>

            {['city', 'village'].map((k) => (
                <datalist key={k} id={`audience-${k}`}>
                    {(suggestions[k] ?? []).map((v) => (
                        <option key={v} value={v} />
                    ))}
                </datalist>
            ))}
        </fieldset>
    );
}
