import { Check } from 'lucide-react';
import { setLanguage } from '@/app/actions/session';
import { getChosenLocale, getT } from '@/lib/i18n/server';
import { safeNext, sp1 } from '@/lib/url';

export default async function LanguagePage({ searchParams }) {
    const sp = await searchParams;
    const next = safeNext(sp1(sp.next));
    const chosen = await getChosenLocale();
    const { t } = await getT();

    // Both labels are always shown in their own script — someone who cannot read
    // English must still be able to find ગુજરાતી.
    const options = [
        { locale: 'gu', label: 'ગુજરાતી', sub: 'Gujarati' },
        { locale: 'en', label: 'English', sub: 'અંગ્રેજી' },
    ];

    return (
        <div>
            <h1 className="text-base font-semibold text-primary">{t('lang.title')}</h1>
            <p className="mt-1 text-xs text-ink-gray">Choose your language · તમારી ભાષા પસંદ કરો</p>
            <div className="mt-5 grid gap-3">
                {options.map((o) => (
                    <form key={o.locale} action={setLanguage}>
                        <input type="hidden" name="locale" value={o.locale} />
                        <input type="hidden" name="next" value={next} />
                        <button
                            type="submit"
                            lang={o.locale}
                            className={`flex h-14 w-full items-center justify-between rounded-lg border px-4 text-left hover:bg-accent ${
                                chosen === o.locale ? 'border-primary ring-2 ring-ring/30' : 'border-surface-border'
                            }`}
                        >
                            <span>
                                <span className="block text-base font-semibold text-primary">{o.label}</span>
                                <span className="block text-xs text-ink-gray">{o.sub}</span>
                            </span>
                            {chosen === o.locale && <Check className="size-5 text-primary" />}
                        </button>
                    </form>
                ))}
            </div>
            <p className="mt-4 text-xs text-ink-gray">{t('lang.subtitle')}</p>
        </div>
    );
}
