import { Languages } from 'lucide-react';
import SamajLogo from '@/components/shell/samaj-logo';
import { setLanguage } from '@/app/actions/session';
import { getT } from '@/lib/i18n/server';
import { getSettings } from '@/lib/settings';

// Public pages: no account, no app shell. The language toggle works without a session —
// setLanguage only writes the cookie when nobody is signed in.
export default async function PublicLayout({ children }) {
    const [{ t, locale }, general] = await Promise.all([getT(), getSettings('admin')]);
    const other = locale === 'gu' ? 'en' : 'gu';
    // The Samaj's own name when set (Gujarati spelling on a Gujarati page), else the app's.
    const brand = (locale === 'gu' && general.samaj_name_local) || general.samaj_name || t('app.name');
    return (
        <div className="min-h-dvh bg-surface-login">
            {/* Navy like the app's header, with the same orange logo and the Samaj name. */}
            <header className="no-print bg-brand-navy text-white">
                <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                        <SamajLogo settings={general} name={brand} />
                        <span className="min-w-0 truncate text-base font-semibold">{brand}</span>
                    </div>
                    <form action={setLanguage}>
                        <input type="hidden" name="locale" value={other} />
                        <button
                            type="submit"
                            className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-white/20 bg-white/10 px-2.5 text-sm font-medium text-white hover:bg-white/20"
                        >
                            <Languages className="size-4" />
                            <span lang={other}>{other === 'gu' ? 'ગુજરાતી' : 'English'}</span>
                        </button>
                    </form>
                </div>
            </header>
            {children}
        </div>
    );
}
