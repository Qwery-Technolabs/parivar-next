'use client';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState } from 'react';
import { toast } from 'sonner';
import { createMember } from '@/app/actions/members';
import SubmitButton from '@/components/ui/submit-button';
import { AccessFields, BasicFields, CommunityFields, DetailFields, PasswordField } from './member-fields';
import { useT } from '@/lib/i18n/client';

/** One card per group, titled like the Edit page's tabs. */
function Card({ title, children }) {
    return (
        <section className="min-w-0 rounded-lg border border-surface-border bg-white shadow-sm">
            <h2 className="rounded-t-lg border-b border-surface-border bg-card-head px-3.5 py-2 text-sm font-semibold text-primary">{title}</h2>
            <div className="p-3.5">{children}</div>
        </section>
    );
}

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


    // onSubmit + startTransition rather than <form action>: React resets uncontrolled
    // fields after a form action, which would wipe the input on a validation error.
    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
    };

    return (
        <form onSubmit={onSubmit} className="space-y-3">
            <Card title={t('members.tabs.basic')}>
                <BasicFields fe={fe} villages={villages} cities={cities} />
            </Card>
            <div className="grid items-start gap-3 lg:grid-cols-2">
                <Card title={t('members.tabs.community')}>
                    <CommunityFields fe={fe} casteOptions={casteOptions} />
                </Card>
                <div className="space-y-3">
                    <Card title={t('members.tabs.access')}>
                        <AccessFields roles={roles} />
                    </Card>
                    <Card title={t('members.setPassword')}>
                        <PasswordField fe={fe} />
                    </Card>
                </div>
            </div>
            <Card title={t('members.tabs.details')}>
                <DetailFields />
            </Card>

            {state?.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {t(state.error)}
                </p>
            )}
            <div className="flex flex-row gap-2 *:flex-1 sm:*:flex-none sm:justify-end">
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
