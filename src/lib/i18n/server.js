import 'server-only';
import { cookies } from 'next/headers';
import { cache } from 'react';
import { DEFAULT_LOCALE, LANG_COOKIE, normalizeLocale, translate } from './config';
import en from './dictionaries/en';
import gu from './dictionaries/gu';

const DICTS = { en, gu };

/** The chosen locale, or null when the visitor has never picked one. */
export const getChosenLocale = cache(async () => normalizeLocale((await cookies()).get(LANG_COOKIE)?.value));

export const getLocale = cache(async () => (await getChosenLocale()) ?? DEFAULT_LOCALE);

export function getDictionary(locale) {
    return DICTS[locale] ?? DICTS[DEFAULT_LOCALE];
}

/** Server-side translator: `const { t, locale } = await getT()`. */
export async function getT() {
    const locale = await getLocale();
    const dict = getDictionary(locale);
    return { locale, dict, t: (key, vars) => translate(dict, key, vars) };
}
