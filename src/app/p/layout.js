import { Languages, Users } from 'lucide-react';
import { setLanguage } from '@/app/actions/session';
import { getT } from '@/lib/i18n/server';

// Public pages: no account, no app shell. The language toggle works without a session —
// setLanguage only writes the cookie when nobody is signed in.
export default async function PublicLayout({ children }) {
    const { t, locale } = await getT();
    const other = locale === 'gu' ? 'en' : 'gu';
    return (
        <div className="min-h-dvh bg-surface-login">
            <header className="no-print border-b border-surface-border bg-white">
                <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-3 px-4">
                    <div className="flex items-center gap-2 text-primary">
                        <span className="flex size-8 items-center justify-center rounded-md bg-primary text-white">
                            <Users className="size-4" />
                        </span>
                        <span className="text-base font-semibold">{t('app.name')}</span>
                    </div>
                    <form action={setLanguage}>
                        <input type="hidden" name="locale" value={other} />
                        <button
                            type="submit"
                            className="inline-flex h-9 items-center gap-1.5 rounded-md border border-surface-border bg-white px-2.5 text-sm font-medium text-primary hover:bg-accent"
                        >
                            <Languages className="size-4 text-ink-gray" />
                            <span lang={other}>{other === 'gu' ? 'ગુજરાતી' : 'English'}</span>
                        </button>
                    </form>
                </div>
            </header>
            {children}
        </div>
    );
}
