'use client';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { toLocalScript } from '@/lib/local-language';

// Google Input Tools suggestions (via /api/transliterate), cached for the session.
const cache = new Map(); // `${lang}:${text}` → string[]

async function googleSuggestions(text, lang, signal) {
    const key = `${lang}:${text}`;
    if (cache.has(key)) return cache.get(key);
    const res = await fetch(`/api/transliterate?lang=${encodeURIComponent(lang)}&text=${encodeURIComponent(text)}`, { signal });
    if (!res.ok) throw new Error(String(res.status));
    const { suggestions } = await res.json();
    if (!Array.isArray(suggestions) || !suggestions.length) throw new Error('empty');
    cache.set(key, suggestions);
    return suggestions;
}

/**
 * Pair an English field with its local-language twin (Gujarati by default; the person's
 * chosen script otherwise), like Google Input Tools: type English in the English field, and the
 * local field fills in — at once with the built-in spelling rules, then with Google's 1st
 * suggestion — with a numbered list under it of Google's suggestions plus the English text itself
 * as the last choice. Click one, or ↑ / ↓ in the English field, to take it. Once the person types
 * in the local field themselves, their spelling is kept.
 *
 * The ↻ button (GujaratiField) walks the suggestions: the 1st press shows the 1st, the next the
 * 2nd, then the 3rd … and round again. Typing English or editing the local field by hand starts
 * the count over, so after a manual edit ↻ gives the 1st suggestion again.
 *
 * A record that already has a local value starts as "manual", so editing the English
 * spelling of an existing name never overwrites a local name someone typed carefully.
 *
 * @param {string} [initialEn]
 * @param {string} [initialGu]
 */
export function useAutoGujarati(initialEn = '', initialGu = '') {
    const { localLang } = useT();
    const local = (text) => toLocalScript(text, localLang);
    const [gu, setGu] = useState(initialGu || '');
    const [manual, setManual] = useState(Boolean(initialGu));
    const [en, setEn] = useState(initialEn || '');
    const [choices, setChoices] = useState([]); // Google's suggestions + the English text, for the list
    const [active, setActive] = useState(-1); // index in `choices` now in the field
    const [open, setOpen] = useState(false);
    // Read only in handlers / timers: the latest English text and manual flag, the debounce, ↻ presses.
    const enRef = useRef(initialEn || '');
    const manualRef = useRef(Boolean(initialGu));
    const focusRef = useRef(false);
    const timer = useRef(null);
    const closer = useRef(null);
    const ctrl = useRef(null);
    const presses = useRef(0);

    useEffect(
        () => () => {
            clearTimeout(timer.current);
            clearTimeout(closer.current);
            ctrl.current?.abort();
        },
        [],
    );

    const lookup = async (text) => {
        ctrl.current?.abort();
        ctrl.current = new AbortController();
        const list = await googleSuggestions(text.trim(), localLang, ctrl.current.signal);
        // The English spelling itself is always the last choice.
        return list.includes(text.trim()) ? list : [...list, text.trim()];
    };
    const show = (list, i) => {
        setChoices(list);
        setActive(i);
        setGu(list[i]);
        setManual(false);
        manualRef.current = false;
    };
    // The list stays open while either field has focus; a short delay lets a click on it land first.
    const focus = () => {
        clearTimeout(closer.current);
        focusRef.current = true;
        setOpen(true);
    };
    const blur = () => {
        focusRef.current = false;
        closer.current = setTimeout(() => setOpen(false), 150);
    };

    return {
        manual,
        /** { n, total } of the Google suggestion shown (for "2 of 5"), else null. */
        position: manual || active < 0 ? null : { n: active + 1, total: choices.length },
        /** The numbered list under the local field: { choices, active, open, pick(i) }. */
        list: {
            choices: manual ? [] : choices,
            active,
            open: open && !manual && choices.length > 1,
            pick: (i) => {
                show(choices, i);
                presses.current = i + 1;
                setOpen(false);
            },
        },
        enProps: {
            defaultValue: initialEn || '',
            onFocus: focus,
            onBlur: blur,
            onKeyDown: (e) => {
                // ↑ / ↓ move through the list, like the Google keyboard.
                if (e.currentTarget.tagName !== 'INPUT' || manualRef.current || choices.length < 2 || (e.key !== 'ArrowDown' && e.key !== 'ArrowUp')) return;
                e.preventDefault();
                const i = (active + (e.key === 'ArrowDown' ? 1 : choices.length - 1)) % choices.length;
                show(choices, i);
                presses.current = i + 1;
                setOpen(true);
            },
            onChange: (e) => {
                const v = e.target.value;
                setEn(v);
                enRef.current = v;
                presses.current = 0;
                clearTimeout(timer.current);
                if (manualRef.current) return;
                setGu(local(v));
                setChoices([]);
                setActive(-1);
                if (!/[A-Za-z]/.test(v)) return;
                // A short pause after typing, then Google's 1st suggestion replaces the rule-based one.
                timer.current = setTimeout(() => {
                    lookup(v)
                        .then((list) => {
                            if (enRef.current !== v || manualRef.current) return;
                            show(list, 0);
                            if (focusRef.current) setOpen(true);
                        })
                        .catch(() => {}); // offline / blocked: the rule-based spelling stays
                }, 300);
            },
        },
        guProps: {
            value: gu,
            lang: localLang,
            onFocus: focus,
            onBlur: blur,
            onChange: (e) => {
                setGu(e.target.value);
                const m = e.target.value.trim() !== '';
                setManual(m);
                manualRef.current = m;
                presses.current = 0;
                setActive(-1);
            },
        },
        /** ↻: the next suggestion for the current English text (the 1st after typing or a manual edit). */
        regenerate: async () => {
            const text = enRef.current;
            const k = presses.current;
            presses.current = k + 1;
            if (!/[A-Za-z]/.test(text)) {
                setGu(local(text));
                setManual(false);
                manualRef.current = false;
                return;
            }
            try {
                const list = await lookup(text);
                if (enRef.current !== text) return;
                show(list, k % list.length);
            } catch {
                setGu(local(text));
                setManual(false);
                manualRef.current = false;
            }
        },
    };
}
