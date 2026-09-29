'use client';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { toLocalScript } from '@/lib/local-language';

/**
 * Pair an English field with its local-language twin (Gujarati by default; the person's
 * chosen script otherwise): typing English fills the local field, until the person types in
 * it themselves — from then on their spelling is kept. Clearing it hands it back to auto-fill.
 *
 * A record that already has a local value starts as "manual", so editing the English
 * spelling of an existing name never overwrites a local name someone typed carefully.
 *
 * @param {string} [initialEn]
 * @param {string} [initialGu]
 */
export function useAutoGujarati(initialEn = '', initialGu = '') {
    const { localLang } = useT();
    const suggest = (text) => toLocalScript(text, localLang);
    const [gu, setGu] = useState(initialGu || '');
    const [manual, setManual] = useState(Boolean(initialGu));
    const [en, setEn] = useState(initialEn || '');

    return {
        manual,
        enProps: {
            defaultValue: initialEn || '',
            onChange: (e) => {
                setEn(e.target.value);
                if (!manual) setGu(suggest(e.target.value));
            },
        },
        guProps: {
            value: gu,
            lang: localLang,
            onChange: (e) => {
                setGu(e.target.value);
                setManual(e.target.value.trim() !== '');
            },
        },
        /** Re-run the suggestion from the current English text and resume auto-fill. */
        regenerate: () => {
            setGu(suggest(en));
            setManual(false);
        },
    };
}
