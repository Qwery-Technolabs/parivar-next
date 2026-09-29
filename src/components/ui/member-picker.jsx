'use client';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import Combobox from './combobox';

/**
 * Combobox over /api/members/search. Controlled or uncontrolled; posts `name` as the user id.
 * @param {{ name?: string, defaultValue?: {id: string|number, label: string} | null, onPick?: (opt: any) => void, placeholder?: string, hasError?: boolean, exclude?: Array<string|number> }} props
 */
export default function MemberPicker({ name, defaultValue = null, onPick, placeholder, hasError, exclude = [] }) {
    const { t, locale } = useT();
    const [sel, setSel] = useState(defaultValue ? { value: String(defaultValue.id), label: defaultValue.label } : null);
    const skip = new Set(exclude.map(String));

    return (
        <Combobox
            name={name}
            value={sel?.value ?? ''}
            valueLabel={sel?.label ?? ''}
            placeholder={placeholder ?? t('groups.pickMember')}
            hasError={hasError}
            emptyText={t('common.noResults')}
            fetchOptions={async (q) => {
                const res = await fetch(`/api/members/search?q=${encodeURIComponent(q)}`);
                if (!res.ok) return [];
                const rows = await res.json();
                return rows
                    .filter((r) => !skip.has(r.value))
                    .map((r) => ({ ...r, label: (locale === 'gu' && r.labelGu) || r.label }));
            }}
            onSelect={(opt) => {
                setSel(opt);
                onPick?.(opt);
            }}
        />
    );
}
