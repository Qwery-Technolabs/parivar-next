import { Home } from 'lucide-react';
import Link from 'next/link';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('errors.notFound') };
}

export default async function NotFound() {
    const { t } = await getT();
    return (
        <div className="flex min-h-dvh flex-col items-center justify-center bg-surface-login px-4 text-center">
            <p className="text-[11px] uppercase tracking-wide text-ink-gray">404</p>
            <h1 className="mt-1 text-lg font-semibold text-primary">{t('errors.notFound')}</h1>
            <p className="mt-2 max-w-sm text-sm text-ink-gray">{t('errors.notFoundText')}</p>
            <Link
                href="/"
                className="mt-5 inline-flex h-9 items-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
                <Home className="size-4" /> {t('errors.goHome')}
            </Link>
        </div>
    );
}
