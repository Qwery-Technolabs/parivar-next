'use client';
import { KeyRound } from 'lucide-react';
import { startTransition, useActionState } from 'react';
import { setInitialPassword } from '@/app/actions/session';
import { Field, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import { useT } from '@/lib/i18n/client';

export default function SetPasswordForm() {
    const { t } = useT();
    const [state, action, pending] = useActionState(setInitialPassword, null);
    const fe = (k) => (state?.fieldErrors?.[k] ? t(state.fieldErrors[k]) : null);
    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(() => action(fd));
            }}
            className="mt-5 space-y-3"
        >
            <Field label={t('members.newPassword')} hint={t('members.passwordHint')} error={fe('password')} required>
                <input
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    minLength={6}
                    required
                    className={`${textInput(!!fe('password'), 'h-10')} w-full`}
                />
            </Field>
            <Field label={t('auth.register.confirm')} error={fe('confirm')} required>
                <input name="confirm" type="password" autoComplete="new-password" required className={`${textInput(!!fe('confirm'), 'h-10')} w-full`} />
            </Field>
            <SubmitButton icon={KeyRound} pendingText={t('common.saving')} size="h-10" className="w-full" pending={pending}>
                {t('auth.setPassword.submit')}
            </SubmitButton>
        </form>
    );
}
