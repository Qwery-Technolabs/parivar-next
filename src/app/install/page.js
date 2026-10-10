import InstallApp from '@/components/shell/install-app';
import { getT } from '@/lib/i18n/server';
import { getSettings, samajName } from '@/lib/settings';

// Public (no sign-in, proxy.js lets it through): one link to share — it installs the app the way the
// visitor's phone allows, or opens the dashboard when it is already the installed app.
export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('install.title') };
}

export default async function InstallPage() {
    const [{ t, locale }, general] = await Promise.all([getT(), getSettings('admin')]);
    const samaj = samajName(general, locale) || t('app.name');
    const v = general.logo_version ? `&v=${general.logo_version}` : '';
    return (
        <main className="flex min-h-dvh items-center justify-center bg-surface-login px-4 py-8">
            <div className="w-full max-w-sm">
                <InstallApp samaj={samaj} icon={`/api/app-icon?size=192${v}`} />
            </div>
        </main>
    );
}
