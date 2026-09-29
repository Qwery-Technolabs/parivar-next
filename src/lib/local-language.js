// Pure module — client and server. The "local language" a person writes names in.
// Independent of the UI language (en/gu): someone can use the app in English and still
// keep their name in Gujarati, Hindi or Marathi script.

import { toGujarati } from './transliterate';

export const DEFAULT_LOCAL_LANGUAGE = 'gu';

/**
 * `shift` maps a Gujarati code point onto the target script. The Gujarati (U+0A80) and
 * Devanagari (U+0900) blocks share one layout — ક/क, ળ/ळ, ્/् sit at the same offset — so
 * the Gujarati transliterator serves Hindi and Marathi by subtracting 0x180.
 */
export const LOCAL_LANGUAGES = {
    gu: { label: 'ગુજરાતી', english: 'Gujarati', shift: 0 },
    hi: { label: 'हिन्दी', english: 'Hindi', shift: -0x180 },
    mr: { label: 'मराठी', english: 'Marathi', shift: -0x180 },
};

export function normalizeLocalLanguage(value) {
    return value in LOCAL_LANGUAGES ? value : null;
}

function shiftScript(text, shift) {
    if (!shift) return text;
    let out = '';
    for (const ch of text) {
        const cp = ch.codePointAt(0);
        out += cp >= 0x0a80 && cp <= 0x0aff ? String.fromCodePoint(cp + shift) : ch;
    }
    return out;
}

/** English spelling → the local script (a suggestion; the field stays editable). */
export function toLocalScript(text, lang = DEFAULT_LOCAL_LANGUAGE) {
    const spec = LOCAL_LANGUAGES[lang] ?? LOCAL_LANGUAGES[DEFAULT_LOCAL_LANGUAGE];
    return shiftScript(toGujarati(text), spec.shift);
}
