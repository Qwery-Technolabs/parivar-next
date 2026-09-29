import { Users } from 'lucide-react';
import { getT } from '@/lib/i18n/server';

export default async function AuthLayout({ children }) {
    const { t } = await getT();
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-login px-4 py-10">
            <div className="mb-6 flex items-center gap-2.5 text-primary">
                <span className="flex size-10 items-center justify-center rounded-lg bg-primary text-white">
                    <Users className="size-5" />
                </span>
                <div>
                    <p className="text-lg font-semibold leading-tight">{t('app.name')}</p>
                    <p className="text-xs text-ink-gray">{t('app.tagline')}</p>
                </div>
            </div>
            <div className="w-full max-w-sm rounded-xl border border-surface-border bg-white p-6 shadow-sm">{children}</div>
        </div>
    );
}
