'use client';
import { createContext, useCallback, useContext } from 'react';
import { translate } from './config';

const I18nContext = createContext({ locale: 'gu', dict: {}, localLang: 'gu' });

export function I18nProvider({ locale, dict, localLang = 'gu', children }) {
    return <I18nContext.Provider value={{ locale, dict, localLang }}>{children}</I18nContext.Provider>;
}

/** Client translator: `const { t, locale, localLang } = useT()`. */
export function useT() {
    const { locale, dict, localLang } = useContext(I18nContext);
    const t = useCallback((key, vars) => translate(dict, key, vars), [dict]);
    return { t, locale, localLang };
}
