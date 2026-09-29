'use client';
import { LogIn } from 'lucide-react';
import Link from 'next/link';
import { useActionState } from 'react';
import { login } from '@/app/actions/session';
import { Field, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import { useT } from '@/lib/i18n/client';

export default function LoginForm({ next }) {
    const { t, locale } = useT();
    const [state, action] = useActionState(login, null);
    const err = state?.error ? t(state.error) : null;

    return (
        <form action={action} className="mt-5 space-y-4">
            <input type="hidden" name="next" value={next} />
            <Field label={t('auth.phone')} hint={t('auth.phoneHint')} error={err} required>
                <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    defaultValue={state?.values?.phone ?? ''}
                    required
                    className={`${textInput(!!err, 'h-10')} w-full tabular-nums`}
                />
            </Field>
            <Field label={t('auth.password')} required>
                <input
                    name="password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className={`${textInput(false, 'h-10')} w-full`}
                />
            </Field>
            <SubmitButton icon={LogIn} pendingText={t('auth.loggingIn')} size="h-10" className="w-full">
                {t('auth.login')}
            </SubmitButton>
            <div className="text-center text-xs">
                <Link href={`/language?next=${encodeURIComponent('/login')}`} className="font-medium text-primary hover:underline">
                    {t('lang.switch')}: {locale === 'gu' ? 'ગુજરાતી' : 'English'}
                </Link>
            </div>
        </form>
    );
}
