import { date } from '@/lib/format';
import { DEVELOPER, POLICY_UPDATED, PRIVACY_POLICY } from '@/lib/legal';

/**
 * The privacy policy text (server component) in the page language — Gujarati on a Gujarati screen,
 * else English. Used by the public /privacy-policy page and Settings → About.
 * @param {{ samaj: string, t: Function, locale: string }} props
 */
export default function PrivacyPolicy({ samaj, t, locale }) {
    const sections = PRIVACY_POLICY[locale] ?? PRIVACY_POLICY.en;
    const fill = (s) => s.replaceAll('{samaj}', samaj).replaceAll('{phone}', DEVELOPER.phoneShown);
    return (
        <div className="space-y-4 text-sm leading-relaxed text-ink">
            <p className="text-xs text-ink-gray">{t('about.policyUpdated', { date: date(POLICY_UPDATED, locale) })}</p>
            {sections.map((s, i) => (
                <section key={s.title}>
                    <h2 className="mb-1 text-sm font-semibold text-primary">
                        {i + 1}. {s.title}
                    </h2>
                    {s.body?.map((p) => (
                        <p key={p.slice(0, 40)} className="mb-1.5">
                            {fill(p)}
                        </p>
                    ))}
                    {s.list && (
                        <ul className="ml-5 list-disc space-y-1">
                            {s.list.map((li) => (
                                <li key={li.slice(0, 40)}>{fill(li)}</li>
                            ))}
                        </ul>
                    )}
                </section>
            ))}
        </div>
    );
}
