'use client';
import { createContext, useCallback, useContext } from 'react';
import { translate } from './config';

const I18nContext = createContext({ locale: 'gu', dict: {} });

export function I18nProvider({ locale, dict, children }) {
    return <I18nContext.Provider value={{ locale, dict }}>{children}</I18nContext.Provider>;
}

/** Client translator: `const { t, locale } = useT()`. */
export function useT() {
    const { locale, dict } = useContext(I18nContext);
    const t = useCallback((key, vars) => translate(dict, key, vars), [dict]);
    return { t, locale };
}
