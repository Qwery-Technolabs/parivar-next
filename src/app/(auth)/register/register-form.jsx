'use client';
import { CheckCircle2, UserPlus } from 'lucide-react';
import { startTransition, useActionState } from 'react';
import { register } from '@/app/actions/session';
import NameFields from '@/components/members/name-fields';
import { Field, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import { useT } from '@/lib/i18n/client';
import PasswordInput from '@/components/ui/password-input';

export default function RegisterForm() {
    const { t } = useT();
    const [state, action, pending] = useActionState(register, null);
    const fe = (k) => (state?.fieldErrors?.[k] ? t(state.fieldErrors[k]) : null);
    const v = state?.values ?? {};

    if (state?.pending) {
        return (
            <div role="status" className="mt-5 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-5 text-center">
                <CheckCircle2 className="mx-auto size-8 text-emerald-700" />
                <p className="mt-2 text-sm font-semibold text-emerald-900">{t('auth.register.pendingTitle')}</p>
                <p className="mt-1 text-xs text-emerald-900">{t('auth.register.pending')}</p>
            </div>
        );
    }

    // onSubmit + startTransition rather than <form action>: React resets uncontrolled
    // fields after a form action, which would wipe the input on a validation error.
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(() => action(fd));
            }}
            className="mt-5 space-y-3"
        >
            <NameFields member={v} fe={fe} />
            <Field label={t('auth.phone')} hint={t('auth.phoneHint')} error={fe('phone')} required>
                <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    defaultValue={v.phone ?? ''}
                    required
                    className={`${textInput(!!fe('phone'), 'h-10')} w-full tabular-nums`}
                />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('members.village')}>
                    <input name="village" defaultValue={v.village ?? ''} maxLength={100} className={`${textInput(false, 'h-10')} w-full`} />
                </Field>
                <Field label={t('members.city')}>
                    <input name="city" defaultValue={v.city ?? ''} maxLength={100} className={`${textInput(false, 'h-10')} w-full`} />
                </Field>
            </div>
            <Field label={t('auth.password')} hint={t('members.passwordHint')} error={fe('password')} required>
                <PasswordInput
                    name="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className={`${textInput(!!fe('password'), 'h-10')} w-full`}
                />
            </Field>
            <Field label={t('auth.register.confirm')} error={fe('confirm')} required>
                <PasswordInput
                    name="confirm"
                    autoComplete="new-password"
                    required
                    className={`${textInput(!!fe('confirm'), 'h-10')} w-full`}
                />
            </Field>
            {state?.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {t(state.error)}
                </p>
            )}
            <SubmitButton icon={UserPlus} pendingText={t('auth.register.submitting')} size="h-10" className="w-full" pending={pending}>
                {t('auth.register.submit')}
            </SubmitButton>
        </form>
    );
}
