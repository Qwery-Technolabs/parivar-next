import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';
import { getSettings } from '@/lib/settings';
import RegisterForm from './register-form';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('auth.register.title') };
}

/** Self sign-up — exists only while an admin allows it (Settings → admin). */
export default async function RegisterPage() {
    if (await getCurrentUser()) redirect('/');
    const settings = await getSettings('admin');
    if (!settings.allow_registration) redirect('/login');
    const { t } = await getT();
    return (
        <div>
            <h1 className="text-base font-semibold text-primary">{t('auth.register.title')}</h1>
            <p className="mt-1 text-xs text-ink-gray">{t('auth.register.subtitle')}</p>
            <RegisterForm />
            <p className="mt-4 text-center text-xs">
                <Link href="/login" className="font-medium text-primary hover:underline">
                    {t('auth.register.haveAccount')}
                </Link>
            </p>
        </div>
    );
}
