import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';
import { getT } from '@/lib/i18n/server';
import SetPasswordForm from './set-password-form';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('auth.setPassword.title') };
}

/**
 * First sign-in of someone added by phone number (temporary password = the number).
 * The app layout sends them here until they choose their own password.
 */
export default async function SetPasswordPage() {
    const user = await getCurrentUser();
    if (!user) redirect('/login');
    if (!user.must_change_password) redirect('/');
    const { t } = await getT();
    return (
        <div>
            <h1 className="text-base font-semibold text-primary">{t('auth.setPassword.title')}</h1>
            <p className="mt-1 text-xs text-ink-gray">{t('auth.setPassword.subtitle')}</p>
            <SetPasswordForm />
        </div>
    );
}
