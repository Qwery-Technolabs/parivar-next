import SamajLogo from '@/components/shell/samaj-logo';
import { getT } from '@/lib/i18n/server';
import { getSettings } from '@/lib/settings';

export default async function AuthLayout({ children }) {
    const [{ t, locale }, general] = await Promise.all([getT(), getSettings('admin')]);
    const brand = (locale === 'gu' && general.samaj_name_local) || general.samaj_name || t('app.name');
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-login px-4 py-10">
            <div className="mb-6 flex items-center gap-2.5 text-primary">
                <SamajLogo settings={general} name={brand} size="md" />
                <div>
                    <p className="text-lg font-semibold leading-tight">{brand}</p>
                    <p className="text-xs text-ink-gray">{t('app.tagline')}</p>
                </div>
            </div>
            <div className="w-full max-w-sm rounded-xl border border-surface-border bg-white p-6 shadow-sm">{children}</div>
        </div>
    );
}
