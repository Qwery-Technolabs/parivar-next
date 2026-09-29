import { Geist, Geist_Mono, Noto_Sans_Devanagari, Noto_Sans_Gujarati } from 'next/font/google';
import { Toaster } from '@/components/ui/sonner';
import { I18nProvider } from '@/lib/i18n/client';
import { getDictionary, getLocalLanguage, getLocale } from '@/lib/i18n/server';
import './globals.css';

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] });
const geistMono = Geist_Mono({ variable: '--font-geist-mono', subsets: ['latin'] });
// Geist has no Gujarati glyphs — without this the browser picks whatever system font
// it has, which on many Android phones is a heavy display face at 14px.
const gujarati = Noto_Sans_Gujarati({
    variable: '--font-gujarati',
    subsets: ['gujarati'],
    weight: ['400', '500', '600'],
});
// Hindi / Marathi names (local language) are Devanagari — also absent from Geist.
const devanagari = Noto_Sans_Devanagari({
    variable: '--font-devanagari',
    subsets: ['devanagari'],
    weight: ['400', '500', '600'],
});

export async function generateMetadata() {
    const dict = getDictionary(await getLocale());
    return { title: { default: dict.app.name, template: `%s · ${dict.app.name}` }, description: dict.app.tagline };
}

export const viewport = { themeColor: '#172f56', width: 'device-width', initialScale: 1 };

export default async function RootLayout({ children }) {
    const [locale, localLang] = await Promise.all([getLocale(), getLocalLanguage()]);
    return (
        <html lang={locale} className={`${geistSans.variable} ${geistMono.variable} ${gujarati.variable} ${devanagari.variable} h-full antialiased`}>
            <body className="min-h-full bg-white text-sm text-ink">
                <I18nProvider locale={locale} dict={getDictionary(locale)} localLang={localLang}>
                    {children}
                    <Toaster />
                </I18nProvider>
            </body>
        </html>
    );
}
