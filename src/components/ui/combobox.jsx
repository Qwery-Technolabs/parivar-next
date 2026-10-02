'use client';
import { ChevronDown, Loader2, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { textInput } from './field';
import { useDebouncedCallback } from './use-debounce';

/**
 * design-system.md §6 Combobox — async searchable single select.
 * Shows the selected label when closed and the typed query when open; fetches the
 * empty-query list once on first open; ↑/↓/Enter/Escape. `name` posts the value in a form.
 *
 * @param {{
 *   value: string, valueLabel?: string, onSelect: (opt: {value: string, label: string, hint?: string} | null) => void,
 *   fetchOptions: (q: string) => Promise<Array<{value: string, label: string, hint?: string}>>,
 *   placeholder?: string, name?: string, hasError?: boolean, emptyText?: string, clearable?: boolean, size?: string
 * }} props
 */
export default function Combobox({
    value,
    valueLabel = '',
    onSelect,
    fetchOptions,
    placeholder = '',
    name,
    hasError = false,
    emptyText = '—',
    clearable = true,
    size = 'h-9',
}) {
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const [options, setOptions] = useState(null); // null = never fetched
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(0);
    const seq = useRef(0);
    // Right after a choice the list unmounts and focus lands back on the input (a dialog's focus
    // trap, a tap on a phone) — which must not reopen the list. Ignore opens for a moment.
    const chosenAt = useRef(0);
    // Inside a dialog the list must not float: the dialog scrolls and clips it, so half the list
    // hides under its bottom edge. There it opens in the flow instead — the dialog grows to show it.
    const wrap = useRef(null);
    const [inDialog, setInDialog] = useState(false);
    const listId = useId();

    async function load(query) {
        const my = ++seq.current;
        setLoading(true);
        try {
            const rows = await fetchOptions(query);
            if (my === seq.current) {
                setOptions(rows);
                setActive(0);
            }
        } catch {
            if (my === seq.current) setOptions([]);
        } finally {
            if (my === seq.current) setLoading(false);
        }
    }

    // Typing searches 300 ms after the last key (useDebouncedCallback).
    const loadLater = useDebouncedCallback((v) => load(v));

    function openList() {
        if (open || Date.now() - chosenAt.current < 400) return;
        setInDialog(Boolean(wrap.current?.closest('[data-slot="dialog-content"]')));
        setOpen(true);
        setQ('');
        if (options === null) load('');
    }

    function close() {
        setOpen(false);
        setQ(''); // closing without choosing restores the selected label
    }

    function choose(opt) {
        chosenAt.current = Date.now();
        onSelect(opt);
        setOpen(false);
        setQ('');
    }

    function onType(e) {
        const v = e.target.value;
        setQ(v);
        if (!open) setOpen(true);
        loadLater(v);
    }

    function onKeyDown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            openList();
            setActive((a) => Math.min(a + 1, (options?.length || 1) - 1));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === 'Enter' && open) {
            e.preventDefault(); // never submit the surrounding form from inside the list
            if (options?.[active]) choose(options[active]);
        } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            close();
        }
    }

    return (
        <div ref={wrap} className="relative min-w-0">
            {name && <input type="hidden" name={name} value={value ?? ''} />}
            <input
                role="combobox"
                aria-controls={listId}
                aria-expanded={open}
                aria-autocomplete="list"
                value={open ? q : valueLabel}
                placeholder={open && valueLabel ? valueLabel : placeholder}
                onFocus={openList}
                onClick={openList}
                onChange={onType}
                onKeyDown={onKeyDown}
                // In a dialog there is no backdrop to click: leaving the field closes the list (options keep focus on press).
                onBlur={() => inDialog && open && close()}
                className={`${textInput(hasError, size)} w-full pr-14`}
            />
            <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center gap-1 text-ink-gray">
                {loading ? <Loader2 className="size-4 animate-spin" /> : <ChevronDown className="size-4" />}
            </span>
            {clearable && value && !open && (
                <button
                    type="button"
                    aria-label="Clear"
                    onClick={() => onSelect(null)}
                    className="absolute inset-y-0 right-7 flex items-center px-1 text-ink-gray hover:text-primary"
                >
                    <X className="size-3.5" />
                </button>
            )}
            {open && (
                <>
                    {!inDialog && <button type="button" aria-hidden tabIndex={-1} onClick={close} className="fixed inset-0 z-10 cursor-default" />}
                    <ul
                        id={listId}
                        role="listbox"
                        className={`${inDialog ? 'relative' : 'absolute left-0 right-0 z-20'} mt-1 max-h-64 overflow-y-auto rounded-md border border-surface-border bg-white py-1 shadow-lg`}
                    >
                        {options?.length === 0 && !loading && <li className="px-3 py-2 text-sm text-ink-gray">{emptyText}</li>}
                        {options === null && loading && (
                            <li className="flex justify-center py-3">
                                <Loader2 className="size-4 animate-spin text-ink-gray" />
                            </li>
                        )}
                        {options?.map((opt, i) => (
                            <li
                                key={opt.value}
                                role="option"
                                aria-selected={opt.value === value}
                                onMouseEnter={() => setActive(i)}
                                onMouseDown={(e) => e.preventDefault()}
                                onClick={() => choose(opt)}
                                className={`cursor-pointer px-3 py-1.5 ${i === active ? 'bg-accent' : ''}`}
                            >
                                <span className={`block text-sm text-primary ${opt.value === value ? 'font-semibold' : ''}`}>
                                    {opt.label}
                                </span>
                                {opt.hint && <span className="block text-xs text-ink-gray">{opt.hint}</span>}
                            </li>
                        ))}
                    </ul>
                </>
            )}
        </div>
    );
}
