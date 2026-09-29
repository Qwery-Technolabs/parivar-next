'use client';
import { Field, selectInput } from '@/components/ui/field';
import { useT } from '@/lib/i18n/client';

/**
 * Caste → sub-caste pair. Controlled by the parent so it works in a posted form (via
 * `names`) and in the filter draft alike. Changing the caste clears the sub-caste, since
 * the old one belongs to a different caste.
 * @param {{ options: { castes: Array<{value: string, label: string}>, subcastes: Record<string, Array<{value: string, label: string}>> },
 *           caste: string, subcaste: string, onChange: (next: { caste: string, subcaste: string }) => void,
 *           names?: { caste: string, subcaste: string }, anyLabel?: string, errors?: { caste?: string|null, subcaste?: string|null },
 *           current?: { caste?: {value: string, label: string}, subcaste?: {value: string, label: string} } }} props
 */
export default function CasteSelect({ options, caste, subcaste, onChange, names, anyLabel = '—', errors = {}, current = {} }) {
    const { t } = useT();
    // A deactivated caste already on the member is not in the active list; keep it selectable
    // so editing the member does not silently drop it.
    const castes =
        current.caste && !options.castes.some((o) => o.value === current.caste.value)
            ? [...options.castes, current.caste]
            : options.castes;
    let subs = options.subcastes[caste] ?? [];
    if (current.subcaste && caste === current.caste?.value && !subs.some((o) => o.value === current.subcaste.value))
        subs = [...subs, current.subcaste];

    return (
        <>
            <Field label={t('members.caste')} error={errors.caste}>
                <select
                    name={names?.caste}
                    value={caste}
                    onChange={(e) => onChange({ caste: e.target.value, subcaste: '' })}
                    className={`${selectInput(!!errors.caste)} w-full`}
                >
                    <option value="">{anyLabel}</option>
                    {castes.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label={t('members.subcaste')} error={errors.subcaste}>
                <select
                    name={names?.subcaste}
                    value={subcaste}
                    disabled={!caste || subs.length === 0}
                    onChange={(e) => onChange({ caste, subcaste: e.target.value })}
                    className={`${selectInput(!!errors.subcaste)} w-full`}
                >
                    <option value="">{anyLabel}</option>
                    {subs.map((o) => (
                        <option key={o.value} value={o.value}>
                            {o.label}
                        </option>
                    ))}
                </select>
            </Field>
        </>
    );
}
