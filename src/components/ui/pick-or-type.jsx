'use client';
import { ChevronDown, X } from 'lucide-react';
import { useId, useRef, useState } from 'react';
import { textInput } from './field';
import FloatingList from './floating-list';

/**
 * One value, picked from a list or typed — the replacement for <datalist> (native village,
 * current city, fundraise place, audience rows). A plain text box: it shows the current
 * value, filters the list as you type, and a click on an entry fills it in. Not a chip
 * field, so it is safe inside a <label>: clicking the label only focuses the box.
 * Keyboard: ↓/↑ move, Enter picks, Escape closes.
 * @param {{ name: string, defaultValue?: string, value?: string, onChange?: (v: string) => void,
 *           suggestions: Array<string | { value: string, label: string, count?: number }>,
 *           placeholder?: string, label?: string, maxLength?: number }} props
 */
export default function PickOrType({ name, defaultValue = '', value, onChange, suggestions, placeholder = '', label, maxLength = 150 }) {
    const [own, setOwn] = useState(defaultValue ?? '');
    const current = value ?? own;
    const set = (v) => (onChange ? onChange(v) : setOwn(v));
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    // Typing filters; right after focusing (or picking) the whole list shows.
    const [filtering, setFiltering] = useState(false);
    const listId = useId();
    const inputRef = useRef(null);
    const wrap = useRef(null);

    const options = suggestions.map((s) => (typeof s === 'string' ? { value: s, label: s } : s));
    const needle = filtering ? current.trim().toLowerCase() : '';
    const matches = options.filter((o) => !needle || o.label.toLowerCase().includes(needle)).slice(0, 50);

    const pick = (v) => {
        set(v);
        setOpen(false);
        setFiltering(false);
    };

    function onKeyDown(e) {
        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setOpen(true);
            setActive((a) => Math.min(a + 1, Math.max(matches.length - 1, 0)));
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setActive((a) => Math.max(a - 1, 0));
        } else if (e.key === 'Enter' && open) {
            // Enter picks the highlighted entry and never submits the form from here.
            e.preventDefault();
            if (matches[active]) pick(matches[active].value);
            else setOpen(false);
        } else if (e.key === 'Escape' && open) {
            e.stopPropagation();
            setOpen(false);
        }
    }

    return (
        <div ref={wrap} className="relative min-w-0">
            <input
                ref={inputRef}
                name={name}
                value={current}
                maxLength={maxLength}
                autoComplete="off"
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                aria-autocomplete="list"
                aria-label={label}
                placeholder={placeholder}
                onChange={(e) => {
                    set(e.target.value);
                    setFiltering(true);
                    setActive(0);
                    setOpen(true);
                }}
                onFocus={() => {
                    setFiltering(false);
                    setOpen(true);
                }}
                onBlur={() => setOpen(false)}
                onKeyDown={onKeyDown}
                className={`${textInput()} w-full pr-14`}
            />
            <span className="absolute inset-y-0 right-1.5 flex items-center gap-0.5">
                {current && (
                    <button
                        type="button"
                        tabIndex={-1}
                        aria-label={`${label ?? ''} ×`}
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                            e.preventDefault();
                            set('');
                            inputRef.current?.focus();
                        }}
                        className="flex size-6 items-center justify-center rounded text-ink-gray hover:bg-accent hover:text-primary"
                    >
                        <X className="size-3.5" />
                    </button>
                )}
                <ChevronDown aria-hidden className="pointer-events-none size-4 text-ink-gray" />
            </span>
            {open && matches.length > 0 && (
                // On the page's top layer — never clipped by the card it sits in.
                <FloatingList anchorRef={wrap} id={listId} role="listbox">
                    {matches.map((o, i) => (
                        <li
                            key={o.value}
                            role="option"
                            aria-selected={o.value === current}
                            onMouseEnter={() => setActive(i)}
                            // Keep focus in the box, so blur does not close the list mid-click.
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                                e.preventDefault();
                                pick(o.value);
                            }}
                            className={`flex cursor-pointer items-center justify-between gap-3 px-3 py-1.5 text-sm text-primary ${
                                i === active ? 'bg-accent' : ''
                            } ${o.value === current ? 'font-semibold' : ''}`}
                        >
                            <span className="min-w-0 truncate">{o.label}</span>
                            {o.count != null && <span className="shrink-0 text-xs text-ink-gray tabular-nums">{o.count}</span>}
                        </li>
                    ))}
                </FloatingList>
            )}
        </div>
    );
}
