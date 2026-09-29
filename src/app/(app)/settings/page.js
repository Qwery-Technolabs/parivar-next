import { ChevronRight, Network } from 'lucide-react';
import Link from 'next/link';
import PageHeader from '@/components/shell/page-header';
import SettingsForm from '@/components/settings/settings-form';
import { requireRole } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';
import { getSettings, SETTINGS } from '@/lib/settings';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('settings.title') };
}

export default async function SettingsPage() {
    await requireRole('administrator');
    const { t } = await getT();
    const modules = Object.keys(SETTINGS);
    const values = await Promise.all(modules.map((m) => getSettings(m)));

    return (
        <div className="mx-auto max-w-3xl space-y-4">
            <PageHeader title={t('settings.title')} subtitle={t('settings.subtitle')} />
            <Link
                href="/settings/castes"
                className="flex items-center gap-3 rounded-lg border border-surface-border bg-white p-4 shadow-sm hover:bg-accent/40"
            >
                <Network className="size-5 shrink-0 text-ink-gray" />
                <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-primary">{t('settings.castesLink')}</span>
                    <span className="block text-xs text-ink-gray">{t('settings.castesHint')}</span>
                </span>
                <ChevronRight className="size-4 shrink-0 text-ink-gray" />
            </Link>
            {modules.map((m, i) => (
                <SettingsForm
                    key={m}
                    module={m}
                    title={t(`settings.modules.${m}`)}
                    fields={Object.entries(SETTINGS[m].keys).map(([key, def]) => {
                        const hintKey = `settings.hints.${m}_${key}`;
                        const hint = t(hintKey);
                        return {
                            key,
                            type: def.type,
                            value: values[i][key],
                            label: t(`settings.keys.${m}_${key}`),
                            hint: hint === hintKey ? undefined : hint,
                            options: def.options?.map((o) => ({ value: o, label: t(`lang.${o}`) })),
                        };
                    })}
                />
            ))}
        </div>
    );
}
