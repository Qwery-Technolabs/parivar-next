'use client';
import { useState } from 'react';
import Combobox from '@/components/ui/combobox';
import { useT } from '@/lib/i18n/client';

/**
 * Pick a Mandal schedule — a searchable list like the member picker, each option on two lines:
 * "11 Jul 2026 - Mandal" and, in grey, its place · amount per person · who keeps the money. Posts the
 * schedule id as `name` ('' = none). `allowEmpty`: clearable, and empty shows `emptyLabel` (e.g.
 * "Common savings"). `onChange(value)` tells the form which schedule is chosen.
 * @param {{ name: string, options: Array<{ value: number|string, label: string, hint?: string }>, defaultValue?: number|string|null,
 *           onChange?: (v: string) => void, allowEmpty?: boolean, emptyLabel?: string, hasError?: boolean }} props
 */
export default function ScheduleSelect({ name, options, defaultValue = null, onChange, allowEmpty = false, emptyLabel = '', hasError = false }) {
    const { t } = useT();
    const list = options.map((o) => ({ ...o, value: String(o.value) }));
    const [sel, setSel] = useState(() => list.find((o) => o.value === String(defaultValue ?? '')) ?? null);
    const search = async (q) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return list;
        return list.filter((o) => `${o.label} ${o.hint ?? ''}`.toLowerCase().includes(needle));
    };
    return (
        <Combobox
            name={name}
            value={sel?.value ?? ''}
            valueLabel={sel?.label ?? ''}
            onSelect={(opt) => {
                if (!opt && !allowEmpty) return;
                setSel(opt);
                onChange?.(opt?.value ?? '');
            }}
            fetchOptions={search}
            placeholder={allowEmpty && emptyLabel ? emptyLabel : t('mandal.searchSchedule')}
            hasError={hasError}
            emptyText={t('mandal.searchNone')}
            clearable={allowEmpty}
        />
    );
}
