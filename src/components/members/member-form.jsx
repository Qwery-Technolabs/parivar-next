'use client';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState } from 'react';
import { toast } from 'sonner';
import { createMember } from '@/app/actions/members';
import SubmitButton from '@/components/ui/submit-button';
import { AccessFields, BasicFields, CommunityFields, DetailFields, PasswordField } from './member-fields';
import { useT } from '@/lib/i18n/client';

/**
 * Add-member form: every field group on one page, one save. Editing an existing member
 * uses MemberEditTabs instead (a tab and a save per group).
 * @param {{ roles: string[], villages: string[], cities?: string[], casteOptions: any }} props
 */
export default function MemberForm({ roles, villages, cities = [], casteOptions }) {
    const { t } = useT();
    const router = useRouter();

    const [state, action, pending] = useActionState(async (prev, fd) => {
        const res = await createMember(prev, fd);
        if (res?.ok) {
            toast.success(t(res.message));
            router.push(`/members/${res.id}`);
        }
        return res;
    }, null);
    const fe = (k) => (state?.fieldErrors?.[k] ? t(state.fieldErrors[k]) : null);

    const section = 'rounded-lg border border-surface-border bg-white p-3.5 shadow-sm';

    // onSubmit + startTransition rather than <form action>: React resets uncontrolled
    // fields after a form action, which would wipe the input on a validation error.
    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
    };

    return (
        <form onSubmit={onSubmit} className="space-y-3">
            <section className={`${section} space-y-3`}>
                <BasicFields fe={fe} villages={villages} cities={cities} />
                <CommunityFields fe={fe} casteOptions={casteOptions} />
                <AccessFields roles={roles} />
            </section>

            <section className={section}>
                <h2 className="mb-3 text-sm font-semibold text-primary">{t('members.details')}</h2>
                <DetailFields />
            </section>

            <section className={section}>
                <h2 className="mb-3 text-sm font-semibold text-primary">{t('members.setPassword')}</h2>
                <PasswordField fe={fe} />
            </section>

            {state?.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {t(state.error)}
                </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex h-10 items-center justify-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent"
                >
                    {t('common.cancel')}
                </button>
                <SubmitButton icon={Save} pendingText={t('common.saving')} size="h-10" pending={pending}>
                    {t('common.save')}
                </SubmitButton>
            </div>
        </form>
    );
}
