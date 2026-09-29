import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';
import { safeNext, sp1 } from '@/lib/url';
import LoginForm from './login-form';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('auth.loginTitle') };
}

export default async function LoginPage({ searchParams }) {
    const sp = await searchParams;
    const next = safeNext(sp1(sp.next));
    if (await getCurrentUser()) redirect(next);
    const { t } = await getT();
    return (
        <div>
            <h1 className="text-base font-semibold text-primary">{t('auth.loginTitle')}</h1>
            <p className="mt-1 text-xs text-ink-gray">{t('auth.loginSubtitle')}</p>
            <LoginForm next={next} />
            <p className="mt-4 text-xs text-ink-gray">{t('auth.noAccount')}</p>
        </div>
    );
}
