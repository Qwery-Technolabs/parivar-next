'use client';
import { useState } from 'react';
import TagSelect from './tag-select';

/**
 * One free-text value with suggestions — the replacement for <datalist> (village, city,
 * place…). Built on TagSelect: pick a suggestion or type a new value; choosing another
 * replaces the current one, and text typed but not confirmed is kept when the field loses
 * focus. Posts a single `name` input (empty when cleared).
 * @param {{ name: string, defaultValue?: string, value?: string, onChange?: (v: string) => void,
 *           suggestions: Array<string | { value: string, label: string, count?: number }>, placeholder?: string, label?: string }} props
 */
export default function PickOrType({ name, defaultValue = '', value, onChange, suggestions, placeholder = '', label }) {
    const [own, setOwn] = useState(defaultValue ?? '');
    const current = value ?? own;
    const set = (v) => (onChange ? onChange(v) : setOwn(v));
    const options = suggestions.map((s) => (typeof s === 'string' ? { value: s, label: s } : s));
    return (
        <>
            {/* Always post the field, even when cleared, so the server can empty it. */}
            {!current && <input type="hidden" name={name} value="" />}
            <TagSelect
                name={name}
                options={options}
                value={current ? [current] : []}
                // max 2 lets a second pick through; keeping only the newest makes it a replace.
                onChange={(next) => set(next.at(-1) ?? '')}
                max={2}
                allowCustom
                commitOnBlur
                label={label}
                placeholder={placeholder}
                addLabel={(q) => `+ ${q}`}
            />
        </>
    );
}
