'use client';
import { useId, useRef, useState } from 'react';
import { loadSurnameSuggestions } from '@/app/actions/surnames';
import FloatingList from '@/components/ui/floating-list';
import { fetchCached } from '@/lib/client-cache';
import { useT } from '@/lib/i18n/client';
import { nameCase } from '@/lib/names';

const SHOWN = 8;

/**
 * The English surname box of every name form, with suggestions from the community's surnames (Members ⋮ → Surnames:
 * the saved ones + every surname members already use, most-used first). Type a few letters → matching surnames with
 * their local spelling and how many members carry it; picking one fills BOTH boxes (English + the known local
 * spelling — no guessing). Not in the list? Just keep typing: a new surname is fine, and once saved it is in the list
 * for everyone. The list is fetched once per visit, on first focus. `auto` = the useAutoGujarati pair it drives.
 * Other props go to the <input> (name, required, className …).
 */
export default function SurnameInput({ auto, className, ...props }) {
    const { t, localLang } = useT();
    const [all, setAll] = useState(null);
    const [text, setText] = useState(auto.enProps.defaultValue ?? '');
    const [open, setOpen] = useState(false);
    const [active, setActive] = useState(0);
    const wrap = useRef(null);
    const input = useRef(null);
    const listId = useId();

    const load = () => {
        if (all) return;
        fetchCached('surname-suggestions', loadSurnameSuggestions)
            .then((rows) => setAll(Array.isArray(rows) ? rows : []))
            .catch(() => setAll([]));
    };

    // Starts-with first (most used first), then contains; matched on either spelling.
    const needle = text.trim().toLowerCase();
    const matches = (() => {
        if (!all || !needle) return [];
        const hit = (s) => String(s ?? '').toLowerCase();
        const starts = all.filter((s) => hit(s.name).startsWith(needle) || hit(s.local).startsWith(needle));
        const has = all.filter((s) => !starts.includes(s) && (hit(s.name).includes(needle) || hit(s.local).includes(needle)));
        return [...starts, ...has].slice(0, SHOWN);
    })();
    const exact = matches.some((s) => s.name.toLowerCase() === needle);
    const showList = open && needle.length > 0 && all !== null && (matches.length > 0 || needle.length > 1);

    const pick = (s) => {
        if (input.current) input.current.value = s.name;
        setText(s.name);
        auto.adopt(s.name, s.local);
        setOpen(false);
    };

    return (
        <div ref={wrap} className="relative min-w-0">
            <input
                {...props}
                {...auto.enProps}
                ref={input}
                autoComplete="off"
                autoCapitalize="words"
                role="combobox"
                aria-expanded={showList}
                aria-controls={listId}
                aria-autocomplete="list"
                className={className}
                onFocus={(e) => {
                    load();
                    setOpen(true);
                    auto.enProps.onFocus?.(e);
                }}
                onBlur={(e) => {
                    setOpen(false);
                    // Name Case on leaving the box ("PATEL" → "Patel"); the server does the same when saving.
                    e.target.value = nameCase(e.target.value);
                    setText(e.target.value);
                    auto.enProps.onBlur?.(e);
                }}
                onChange={(e) => {
                    setText(e.target.value);
                    setActive(0);
                    setOpen(true);
                    auto.enProps.onChange?.(e);
                }}
                onKeyDown={(e) => {
                    // While the surname list is open, ↑ / ↓ / Enter belong to it; otherwise to the local-spelling list.
                    if (showList && matches.length) {
                        if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
                            e.preventDefault();
                            setActive((a) => (a + (e.key === 'ArrowDown' ? 1 : matches.length - 1)) % matches.length);
                            return;
                        }
                        if (e.key === 'Enter') {
                            e.preventDefault();
                            pick(matches[active] ?? matches[0]);
                            return;
                        }
                    }
                    if (e.key === 'Escape' && showList) {
                        e.stopPropagation();
                        setOpen(false);
                        return;
                    }
                    auto.enProps.onKeyDown?.(e);
                }}
            />
            {showList && (
                <FloatingList anchorRef={wrap} id={listId} role="listbox">
                    {matches.map((s, i) => (
                        <li
                            key={s.name}
                            role="option"
                            aria-selected={i === active}
                            onMouseEnter={() => setActive(i)}
                            onMouseDown={(e) => e.preventDefault()}
                            onClick={(e) => {
                                e.preventDefault();
                                pick(s);
                            }}
                            className={`flex cursor-pointer items-center gap-2 px-3 py-1.5 text-sm text-primary ${i === active ? 'bg-accent' : ''}`}
                        >
                            <span className="min-w-0 truncate font-medium">{s.name}</span>
                            {s.local && (
                                <span lang={localLang} className="min-w-0 truncate text-ink-gray">
                                    {s.local}
                                </span>
                            )}
                            {s.n > 0 && <span className="ml-auto shrink-0 text-xs text-ink-gray tabular-nums">{s.n}</span>}
                        </li>
                    ))}
                    {/* Not in the list: a new surname is allowed — say so, so nobody hunts for a "near enough" one. */}
                    {!exact && needle.length > 1 && (
                        <li role="presentation" className="border-t border-surface-border px-3 py-1.5 text-xs text-ink-gray">
                            {t('members.newSurname', { name: nameCase(text.trim()) })}
                        </li>
                    )}
                </FloatingList>
            )}
        </div>
    );
}
