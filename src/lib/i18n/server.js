import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { getCurrentUser } from '../auth';
import { DEFAULT_LOCAL_LANGUAGE, normalizeLocalLanguage } from '../local-language';
import { getSetting } from '../settings';
import { DEFAULT_LOCALE, LANG_COOKIE, normalizeLocale, translate } from './config';
import en from './dictionaries/en';
import gu from './dictionaries/gu';

const DICTS = { en, gu };

/** The chosen locale, or null when the visitor has never picked one. */
export const getChosenLocale = cache(async () => normalizeLocale((await cookies()).get(LANG_COOKIE)?.value));

/**
 * The UI language: the visitor's own choice (cookie), else the admin's "Default language for new
 * members" (Settings → General), else the built-in default. No first-visit language page.
 */
export const getLocale = cache(async () => {
    const chosen = await getChosenLocale();
    if (chosen) return chosen;
    try {
        return normalizeLocale(await getSetting('admin', 'default_language')) ?? DEFAULT_LOCALE;
    } catch {
        return DEFAULT_LOCALE; // no database (build time)
    }
});

export function getDictionary(locale) {
    return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

/** Server-side translator: `const { t, locale } = await getT()`. */
export async function getT() {
    const locale = await getLocale();
    const dict = getDictionary(locale);
    return { locale, dict, t: (key, vars) => translate(dict, key, vars) };
}

/** The script names are written in: the person's own choice, else the samaj default, else Gujarati. */
export const getLocalLanguage = cache(async () => {
    const user = await getCurrentUser();
    return (
        normalizeLocalLanguage(user?.local_language) ??
        normalizeLocalLanguage(await getSetting('admin', 'local_language')) ??
        DEFAULT_LOCAL_LANGUAGE
    );
});
