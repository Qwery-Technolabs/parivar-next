import { Phone } from 'lucide-react';
import PrivacyPolicy from '@/components/legal/privacy-policy';
import { getT } from '@/lib/i18n/server';
import { DEVELOPER } from '@/lib/legal';
import { getSettings, samajName } from '@/lib/settings';

// Public (no sign-in, proxy.js lets it through): the app's privacy policy in the visitor's language
// (the language cookie, else the Samaj default). The same text sits in Settings → About.
export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('about.privacyPolicy') };
}

export default async function PrivacyPolicyPage() {
    const [{ t, locale }, general] = await Promise.all([getT(), getSettings('admin')]);
    const samaj = samajName(general, locale) || t('app.name');
    return (
        <main className="mx-auto max-w-3xl space-y-5 px-4 py-8">
            <header>
                <p className="text-[11px] uppercase tracking-wide text-ink-gray">{samaj}</p>
                <h1 className="mt-1 text-xl font-semibold text-primary">{t('about.privacyPolicy')}</h1>
            </header>
            <div className="rounded-lg border border-surface-border bg-white p-4 shadow-sm sm:p-6">
                <PrivacyPolicy samaj={samaj} t={t} locale={locale} />
            </div>
            <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center text-xs text-ink-gray">
                {t('about.developedBy')} {DEVELOPER.name} ·
                <a href={`tel:${DEVELOPER.phone}`} className="inline-flex items-center gap-1 font-medium text-primary hover:underline">
                    <Phone className="size-3" />
                    <span className="tabular-nums">{DEVELOPER.phoneShown}</span>
                </a>
            </p>
        </main>
    );
}
