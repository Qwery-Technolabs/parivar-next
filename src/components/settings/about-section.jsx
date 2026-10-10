import { Phone } from 'lucide-react';
import { Card } from '@/components/shell/page-header';
import { DEVELOPER, OPEN_SOURCE } from '@/lib/legal';
import { getSettings, samajName } from '@/lib/settings';
import AboutLinks from './about-links';

/**
 * Settings → About (everyone): one card — who designed and built the app and how to reach them (for any
 * issue, or app development), then two plain links: Privacy policy (its public page, new tab) and
 * Open-source licences (shown below the links once clicked).
 */
export default async function AboutSection({ t, locale }) {
    const samaj = samajName(await getSettings('admin'), locale) || t('app.name');
    return (
        <Card title={samaj}>
            <p className="text-[11px] uppercase tracking-wide text-ink-gray">{t('about.designedBy')}</p>
            <a href={DEVELOPER.url} target="_blank" rel="noreferrer" className="mt-1 inline-block text-base font-semibold text-primary hover:underline">
                {DEVELOPER.company}
            </a>
            <p className="text-sm text-ink">{DEVELOPER.name}</p>
            <a href={`tel:${DEVELOPER.phone}`} className="mt-1 inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline">
                <Phone className="size-3.5" />
                <span className="tabular-nums">{DEVELOPER.phoneShown}</span>
            </a>
            <p className="mt-2 text-xs text-ink-gray">{t('about.contactNote')}</p>

            <div className="mt-4 border-t border-surface-border pt-3">
                <AboutLinks
                    licences={
                        <div>
                            <p className="mb-2 text-xs text-ink-gray">{t('about.licensesHint')}</p>
                            <div className="overflow-x-auto rounded-lg border border-surface-border">
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
                        </div>
                    }
                />
            </div>
        </Card>
    );
}
