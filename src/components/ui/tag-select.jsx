'use client';
import { Plus, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';

/**
 * DESIGN.md §6 TagSelect — multiselect from a list: chips inside the field plus a
 * searchable popup.
 *
 * - Deals in option VALUES (strings), not option objects.
 * - A selected value no longer in `options` still renders as its own chip, so an applied
 *   choice never silently vanishes.
 * - `count` is shown beside an option only when given (it helps choose, e.g. "Patel 214").
 * - `allowCustom`: Enter / comma adds the typed text even when no option matches.
 * - `name`: posts one hidden input per selected value, so it works inside a plain <form>.
 * - `commitOnBlur` (with allowCustom): typed text not yet confirmed is added on leaving the field.
 * Keyboard: ↑/↓ move, Enter picks, Backspace on an empty query removes the last chip,
 * Escape closes.
 *
 * @param {{
 *   options: Array<{ value: string, label: string, count?: number }>,
 *   value: string[],
 *   onChange: (next: string[]) => void,
 *   name?: string,
 *   placeholder?: string,
 *   emptyText?: string,
 *   addLabel?: (q: string) => string,
 *   allowCustom?: boolean,
 *   max?: number,
 *   label?: string,
 *   commitOnBlur?: boolean,
 * }} props
 */
export default function TagSelect({
    options,
    value,
    onChange,
    name,
    placeholder = '',
    emptyText = '—',
    addLabel = (q) => q,
    allowCustom = false,
    max = 100,
    label,
    commitOnBlur = false,
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [active, setActive] = useState(0);
    const inputRef = useRef(null);
    const listId = useId();

    const selected = new Set(value.map((v) => v.toLowerCase()));
    const byValue = new Map(options.map((o) => [o.value.toLowerCase(), o]));
    const query = q.trim();
    const matches = options
        .filter((o) => !selected.has(o.value.toLowerCase()))
        .filter((o) => !query || o.label.toLowerCase().includes(query.toLowerCase()))
        .slice(0, 50);
    const exact = query && (byValue.has(query.toLowerCase()) || selected.has(query.toLowerCase()));
    const canAddCustom = allowCustom && query && !exact && value.length < max;
    // The custom-add row, when present, is the last keyboard target.
    const rows = canAddCustom ? [...matches, { value: query, label: addLabel(query), custom: true }] : matches;

    function add(v) {
        const clean = v.trim().replace(/\s+/g, ' ');
        if (!clean || selected.has(clean.toLowerCase()) || value.length >= max) return;
        // Adopt the list's spelling when it exists, so "patel" becomes "Patel".
        onChange([...value, byValue.get(clean.toLowerCase())?.value ?? clean]);
        setQ('');
        setActive(0);
        inputRef.current?.focus();
    }

    function remove(v) {
        onChange(value.filter((x) => x !== v));
    }

    function onKeyDown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, Math.max(rows.length - 1, 0)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === 'Enter' || (e.key === ',' && allowCustom)) {
            // Never submit the surrounding form from inside the picker.
            e.preventDefault();
            const row = rows[active] ?? (canAddCustom ? { value: query } : null);
            if (row) add(row.value);
        } else if (e.key === 'Backspace' && !q && value.length) {
            remove(value[value.length - 1]);
        } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
        }
    }

    return (
        <div className="relative min-w-0">
            {name && value.map((v) => <input key={v} type="hidden" name={name} value={v} />)}
            <div
                onClick={() => {
                    setOpen(true);
                    inputRef.current?.focus();
                }}
                className="flex min-h-9 w-full cursor-text flex-wrap items-center gap-1 rounded-md border border-surface-border bg-white px-1.5 py-1 focus-within:border-ring focus-within:ring-2 focus-within:ring-ring/30"
            >
                {value.map((v) => {
                    const opt = byValue.get(v.toLowerCase());
                    return (
                        <span
                            key={v}
                            className="inline-flex max-w-full items-center gap-1 rounded-full bg-brand-navy/10 py-0.5 pl-2 pr-1 text-xs font-medium text-brand-navy ring-1 ring-inset ring-brand-navy/20"
                        >
                            <span className="truncate">{opt?.label ?? v}</span>
                            <button
                                type="button"
                                onClick={(e) => {
                                    e.stopPropagation();
                                    remove(v);
                                }}
                                aria-label={`${opt?.label ?? v} ×`}
                                className="flex size-4 shrink-0 items-center justify-center rounded-full hover:bg-brand-navy/20"
                            >
                                <X className="size-3" />
                            </button>
                        </span>
                    );
                })}
                <input
                    ref={inputRef}
                    role="combobox"
                    aria-expanded={open}
                    aria-controls={listId}
                    aria-label={label}
                    value={q}
                    onChange={(e) => {
                        setQ(e.target.value);
                        setActive(0);
                        setOpen(true);
                    }}
                    onFocus={() => setOpen(true)}
                    // Suggestions cancel mousedown, so picking one never blurs; only really leaving does.
                    onBlur={() => {
                        if (commitOnBlur && allowCustom && query) add(query);
                    }}
                    onKeyDown={onKeyDown}
                    placeholder={value.length ? '' : placeholder}
                    className="h-7 min-w-24 flex-1 bg-transparent px-1 text-sm text-primary outline-none"
                />
            </div>
            {open && (
                <>
                    <button type="button" aria-hidden tabIndex={-1} onClick={() => setOpen(false)} className="fixed inset-0 z-10 cursor-default" />
                    <ul
                        id={listId}
                        role="listbox"
                        aria-multiselectable="true"
                        className="absolute left-0 right-0 z-20 mt-1 max-h-64 overflow-y-auto rounded-md border border-surface-border bg-white py-1 shadow-lg"
                    >
                        {rows.length === 0 && <li className="px-3 py-2 text-sm text-ink-gray">{emptyText}</li>}
                        {rows.map((o, i) => (
                            <li
                                key={o.custom ? '__custom' : o.value}
                                role="option"
                                aria-selected={false}
                                onMouseEnter={() => setActive(i)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => add(o.value)}
                                className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm ${
                                    i === active ? 'bg-accent' : ''
                                }`}
                            >
                                <span className={`min-w-0 truncate ${o.custom ? 'inline-flex items-center gap-1 font-medium text-primary' : 'text-primary'}`}>
                                    {o.custom && <Plus className="size-3.5" />}
                                    {o.label}
                                </span>
                                {o.count != null && <span className="shrink-0 text-xs text-ink-gray tabular-nums">{o.count}</span>}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
