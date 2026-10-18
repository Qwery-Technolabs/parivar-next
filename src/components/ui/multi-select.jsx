'use client';
import { Check, ChevronDown, Search, X } from 'lucide-react';
import { useEffect, useId, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';

/**
 * A select2-style multi-select: the chosen options as chips in one box (× removes one), a drop-down list with a
 * search box (past 6 options) and ticks. Posts `name` once per chosen value, plus an empty one, so "nothing chosen"
 * still posts the field (actions/settings.js reads getAll). `exclusive`: a value that stands alone (e.g.
 * 'everyone') — picking it clears the rest, picking another clears it.
 * `summary(count)`: with more than one chosen, the box shows that one line ("2 selected") instead of a chip each.
 * `bulk`: "Select all · Deselect all" above the list (on the options shown — with a search typed, the matches).
 * `inline`: the list opens in the page flow (pushes what follows down) — inside a dialog's scroll box, where a
 * floating list would be cut off. Options may carry `sub` (a grey second line). `onChange(values)` follows the choice.
 * @param {{ name: string, options: Array<{ value: string, label: string, sub?: string }>, defaultValue?: string[], exclusive?: string|null, placeholder?: string, id?: string, summary?: (n: number) => string, bulk?: boolean, inline?: boolean, onChange?: (values: string[]) => void }} props
 */
export default function MultiSelect({ name, options, defaultValue = [], exclusive = null, placeholder, id, summary, bulk = false, inline = false, onChange }) {
    const { t } = useT();
    const [picked, setPickedState] = useState(() => options.map((o) => o.value).filter((v) => defaultValue.includes(v)));
    const setPicked = (fn) =>
        setPickedState((list) => {
            const next = typeof fn === 'function' ? fn(list) : fn;
            onChange?.(next);
            return next;
        });
    const [open, setOpen] = useState(false);
    const [q, setQ] = useState('');
    const box = useRef(null);
    const listId = useId();

    // Closes on a press outside or Escape.
    useEffect(() => {
        if (!open) return;
        const down = (e) => !box.current?.contains(e.target) && setOpen(false);
        const key = (e) => e.key === 'Escape' && setOpen(false);
        document.addEventListener('pointerdown', down);
        document.addEventListener('keydown', key);
        return () => {
            document.removeEventListener('pointerdown', down);
            document.removeEventListener('keydown', key);
        };
    }, [open]);

    const toggle = (v) =>
        setPicked((list) => {
            if (list.includes(v)) return list.filter((x) => x !== v);
            if (exclusive && v === exclusive) return [v];
            // Keep the options' order, whatever order they were picked in.
            const next = [...list.filter((x) => x !== exclusive), v];
            return options.map((o) => o.value).filter((x) => next.includes(x));
        });
    const label = (v) => options.find((o) => o.value === v)?.label ?? v;
    const needle = q.trim().toLowerCase();
    const shown = options.filter((o) => !needle || o.label.toLowerCase().includes(needle) || (o.sub ?? '').toLowerCase().includes(needle));

    return (
        <div ref={box} className="relative">
            <input type="hidden" name={name} value="" />
            {picked.map((v) => (
                <input key={v} type="hidden" name={name} value={v} />
            ))}
            {/* The box: chips + the caret. A div (not a button) so each chip's × is its own button. */}
            <div
                id={id}
                role="combobox"
                aria-expanded={open}
                aria-controls={listId}
                tabIndex={0}
                onClick={() => setOpen((o) => !o)}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ' || e.key === 'ArrowDown') {
                        e.preventDefault();
                        setOpen(true);
                    }
                }}
                className={`flex min-h-9 w-full cursor-pointer items-center gap-1.5 rounded-md border bg-white py-1 pr-2 pl-1.5 text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50 ${
                    open ? 'border-primary' : 'border-surface-border hover:border-ink-gray/50'
                }`}
            >
                <div className="flex min-w-0 flex-1 flex-wrap gap-1">
                    {picked.length === 0 && <span className="px-1.5 py-0.5 text-ink-gray">{placeholder ?? t('settings.pickAny')}</span>}
                    {summary && picked.length > 1 && <span className="px-1.5 py-0.5 font-medium text-primary">{summary(picked.length)}</span>}
                    {(!summary || picked.length <= 1) &&
                        picked.map((v) => (
                            <span
                                key={v}
                                className="inline-flex max-w-full items-center gap-1 rounded bg-accent py-0.5 pr-0.5 pl-2 text-xs font-medium text-primary"
                            >
                                <span className="truncate">{label(v)}</span>
                                <button
                                    type="button"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        toggle(v);
                                    }}
                                    aria-label={`${t('common.remove')}: ${label(v)}`}
                                    className="rounded p-0.5 text-ink-gray hover:bg-white hover:text-destructive"
                                >
                                    <X className="size-3" />
                                </button>
                            </span>
                        ))}
                </div>
                <ChevronDown className={`size-4 shrink-0 text-ink-gray transition-transform ${open ? 'rotate-180' : ''}`} />
            </div>
            {open && (
                <div
                    className={`overflow-hidden rounded-md border border-surface-border bg-white ${inline ? 'mt-1.5' : 'absolute inset-x-0 top-full z-30 mt-1 shadow-lg'}`}
                >
                    {options.length > 6 && (
                        <div className="relative border-b border-surface-border p-1.5">
                            <Search className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-gray" />
                            <input
                                type="search"
                                autoFocus
                                value={q}
                                onChange={(e) => setQ(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && e.preventDefault()}
                                placeholder={t('common.search')}
                                className="h-8 w-full rounded border border-surface-border pr-2 pl-8 text-sm outline-none focus:border-primary"
                            />
                        </div>
                    )}
                    {bulk && (
                        <div className="flex items-center justify-end gap-3 border-b border-surface-border px-3 py-1.5 text-xs font-medium">
                            <button
                                type="button"
                                onClick={() => {
                                    const add = shown.map((x) => x.value).filter((v) => v !== exclusive);
                                    setPicked((list) => options.map((x) => x.value).filter((v) => v !== exclusive && (list.includes(v) || add.includes(v))));
                                }}
                                className="text-primary hover:underline"
                            >
                                {t('common.selectAll')}
                            </button>
                            <button
                                type="button"
                                onClick={() => {
                                    const drop = new Set(shown.map((x) => x.value));
                                    setPicked((list) => list.filter((v) => !drop.has(v)));
                                }}
                                className="text-ink-gray hover:text-destructive hover:underline"
                            >
                                {t('common.deselectAll')}
                            </button>
                        </div>
                    )}
                    <ul id={listId} role="listbox" aria-multiselectable="true" className="max-h-64 overflow-y-auto py-1">
                        {shown.map((o) => {
                            const on = picked.includes(o.value);
                            return (
                                <li key={o.value} role="option" aria-selected={on}>
                                    <button
                                        type="button"
                                        onClick={() => toggle(o.value)}
                                        className={`flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm hover:bg-accent ${on ? 'font-medium text-primary' : 'text-ink'}`}
                                    >
                                        <span
                                            className={`flex size-4 shrink-0 items-center justify-center rounded border ${
                                                on ? 'border-primary bg-primary text-white' : 'border-surface-border bg-white'
                                            }`}
                                        >
                                            {on && <Check className="size-3" />}
                                        </span>
                                        <span className="min-w-0">
                                            <span className="block truncate">{o.label}</span>
                                            {o.sub && <span className="block truncate text-xs font-normal text-ink-gray">{o.sub}</span>}
                                        </span>
                                    </button>
                                </li>
                            );
                        })}
                        {shown.length === 0 && <li className="px-3 py-2 text-sm text-ink-gray">{t('common.noResults')}</li>}
                    </ul>
                </div>
            )}
        </div>
    );
}
