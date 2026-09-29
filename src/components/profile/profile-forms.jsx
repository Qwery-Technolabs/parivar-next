'use client';
import { KeyRound, Phone } from 'lucide-react';
import { startTransition, useActionState, useRef } from 'react';
import { toast } from 'sonner';
import { changePassword, changePhone } from '@/app/actions/profile';
import { Field, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import { useT } from '@/lib/i18n/client';

/**
 * Submits via onSubmit + startTransition, not <form action>: React resets uncontrolled
 * fields after a form action, wiping the input on a validation error. On success the
 * form is reset explicitly — passwords must not sit in the fields.
 */
function useProfileForm(fn) {
    const { t } = useT();
    const ref = useRef(null);
    const [state, formAction, pending] = useActionState(async (prev, fd) => {
        const res = (await fn(prev, fd)) ?? {};
        if (res.ok) {
            toast.success(t(res.message ?? 'common.saved'));
            ref.current?.reset();
        } else if (res.error) toast.error(t(res.error));
        return res;
    }, null);
    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => formAction(fd));
    };
    const fe = (n) => (state?.fieldErrors?.[n] ? t(state.fieldErrors[n]) : null);
    return { ref, onSubmit, pending, fe };
}

export function ChangePhoneForm({ currentPhone }) {
    const { t } = useT();
    const { ref, onSubmit, pending, fe } = useProfileForm(changePhone);
    return (
        <form ref={ref} onSubmit={onSubmit} className="space-y-3">
            <Field label={t('profile.newPhone')} hint={t('auth.phoneHint')} error={fe('phone')} required>
                <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    required
                    placeholder={currentPhone}
                    className={`${textInput(!!fe('phone'))} w-full tabular-nums`}
                />
            </Field>
            <Field label={t('profile.currentPassword')} error={fe('current_password')} required>
                <input
                    name="current_password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className={`${textInput(!!fe('current_password'))} w-full`}
                />
            </Field>
            <SubmitButton icon={Phone} pendingText={t('common.saving')} pending={pending} className="w-full sm:w-auto">
                {t('profile.changePhone')}
            </SubmitButton>
        </form>
    );
}

export function ChangePasswordForm() {
    const { t } = useT();
    const { ref, onSubmit, pending, fe } = useProfileForm(changePassword);
    return (
        <form ref={ref} onSubmit={onSubmit} className="space-y-3">
            <Field label={t('profile.currentPassword')} error={fe('current_password')} required>
                <input
                    name="current_password"
                    type="password"
                    autoComplete="current-password"
                    required
                    className={`${textInput(!!fe('current_password'))} w-full`}
                />
            </Field>
            <div className="grid gap-3 sm:grid-cols-2">
                <Field label={t('profile.newPassword')} error={fe('new_password')} required>
                    <input
                        name="new_password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        required
                        className={`${textInput(!!fe('new_password'))} w-full`}
                    />
                </Field>
                <Field label={t('profile.confirmPassword')} error={fe('confirm_password')} required>
                    <input
                        name="confirm_password"
                        type="password"
                        autoComplete="new-password"
                        minLength={6}
                        required
                        className={`${textInput(!!fe('confirm_password'))} w-full`}
                    />
                </Field>
            </div>
            <SubmitButton icon={KeyRound} pendingText={t('common.saving')} pending={pending} className="w-full sm:w-auto">
                {t('profile.changePassword')}
            </SubmitButton>
        </form>
    );
}
