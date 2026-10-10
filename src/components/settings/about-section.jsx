import { ExternalLink, Phone } from 'lucide-react';
import Link from 'next/link';
import PrivacyPolicy from '@/components/legal/privacy-policy';
import { Card } from '@/components/shell/page-header';
import { DEVELOPER, OPEN_SOURCE } from '@/lib/legal';
import { getSettings, samajName } from '@/lib/settings';

/**
 * Settings → About (everyone): who built the app and how to reach them, the privacy policy (also public at
 * /privacy-policy) and the open-source packages the app is built with, with their licences.
 */
export default async function AboutSection({ t, locale }) {
    const samaj = samajName(await getSettings('admin'), locale) || t('app.name');
    return (
        <div className="space-y-4">
            <Card title={samaj}>
                <dl className="grid gap-x-6 gap-y-2 text-sm sm:grid-cols-[max-content_1fr]">
                    <dt className="text-ink-gray">{t('about.developedBy')}</dt>
                    <dd className="font-medium text-primary">{DEVELOPER.name}</dd>
                    <dt className="text-ink-gray">{t('about.contact')}</dt>
                    <dd>
                        <a href={`tel:${DEVELOPER.phone}`} className="inline-flex items-center gap-1.5 font-medium text-primary hover:underline">
                            <Phone className="size-3.5" />
                            <span className="tabular-nums">{DEVELOPER.phoneShown}</span>
                        </a>
                    </dd>
                </dl>
            </Card>

            <Card
                title={t('about.privacyPolicy')}
                actions={
                    <Link href="/privacy-policy" target="_blank" className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline">
                        <ExternalLink className="size-3.5" /> {t('about.openPublic')}
                    </Link>
                }
            >
                <PrivacyPolicy samaj={samaj} t={t} locale={locale} />
            </Card>

            <Card title={t('about.licenses')} bodyClass="p-0">
                <p className="px-3.5 pt-3 text-xs text-ink-gray">{t('about.licensesHint')}</p>
                <div className="overflow-x-auto p-3.5">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-surface-border bg-surface-login text-left text-xs uppercase tracking-wide text-ink-gray">
                                <th className="px-3 py-2 font-semibold">{t('about.package')}</th>
                                <th className="px-3 py-2 font-semibold">{t('about.license')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {OPEN_SOURCE.map((p) => (
                                <tr key={p.pkg} className="border-b border-surface-border last:border-0">
                                    <td className="px-3 py-2">
                                        <a href={p.url} target="_blank" rel="noreferrer" className="font-medium text-primary hover:underline">
                                            {p.name}
                                        </a>
                                        <span className="block text-xs text-ink-gray">{p.pkg}</span>
                                    </td>
                                    <td className="px-3 py-2 text-ink">{p.license}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </Card>
        </div>
    );
}
