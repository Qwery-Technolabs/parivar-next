'use client';
import { Briefcase, KeyRound, Save, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useState } from 'react';
import { toast } from 'sonner';
import { createMember } from '@/app/actions/members';
import SubmitButton from '@/components/ui/submit-button';
import { MemberTabStrip } from './member-edit-tabs';
import { AccessFields, BasicFields, CommunityFields, DetailFields, PasswordField } from './member-fields';
import { useT } from '@/lib/i18n/client';

const TABS = [
    { key: 'basic', Icon: UserRound },
    { key: 'community', Icon: UsersRound },
    { key: 'details', Icon: Briefcase },
    { key: 'access', Icon: ShieldCheck },
    { key: 'password', Icon: KeyRound },
];
// Which tab holds a field — to jump to the first error.
const TAB_OF = {
    caste_id: 'community',
    subcaste_id: 'community',
    blood_group: 'community',
    role: 'access',
    password: 'password',
};
const tabOf = (field) => TAB_OF[field] ?? (['position', 'occupation', 'education', 'alt_phone', 'email', 'address', 'bio'].includes(field) ? 'details' : 'basic');

/**
 * Add-member page: the same iconed tabs as the Edit page (Basic info, Community, Details, Role,
 * Password), but ONE form and one Save — the tabs only show and hide their fields (all stay
 * mounted, so nothing is lost when switching). A required field or a server error on another
 * tab opens that tab.
 * @param {{ roles: string[], villages: string[], cities?: string[], casteOptions: any }} props
 */
export default function MemberForm({ roles, villages, cities = [], casteOptions }) {
    const { t } = useT();
    const router = useRouter();
    const [tab, setTab] = useState('basic');

    const [state, action, pending] = useActionState(async (prev, fd) => {
        const res = await createMember(prev, fd);
        if (res?.ok) {
            toast.success(t(res.message));
            router.push(`/members/${res.id}`);
        } else if (res?.fieldErrors) {
            const first = Object.keys(res.fieldErrors)[0];
            if (first) setTab(tabOf(first));
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
    // The browser's own check (required, type=email …) on a hidden tab: open that tab first.
    const onInvalid = (e) => {
        const name = e.target?.name;
        if (name && tabOf(name) !== tab) setTab(tabOf(name));
    };

    return (
        <form onSubmit={onSubmit} onInvalidCapture={onInvalid} className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
            <MemberTabStrip tabs={TABS} tab={tab} onOpen={setTab} label={t('members.add')} />
            {TABS.map(({ key }) => (
                <div key={key} role="tabpanel" id={`panel-${key}`} aria-labelledby={`tab-${key}`} hidden={tab !== key} className="p-3.5">
                    {key === 'basic' ? (
                        <BasicFields fe={fe} villages={villages} cities={cities} />
                    ) : key === 'community' ? (
                        <CommunityFields fe={fe} casteOptions={casteOptions} />
                    ) : key === 'details' ? (
                        <DetailFields />
                    ) : key === 'access' ? (
                        <AccessFields roles={roles} />
                    ) : (
                        <PasswordField fe={fe} />
                    )}
                </div>
            ))}

            <div className="space-y-3 px-3.5 pb-3.5">
                {state?.error && (
                    <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                        {t(state.error)}
                    </p>
                )}
                <div className="flex flex-row gap-2 border-t border-surface-border pt-3 *:flex-1 sm:justify-end sm:*:flex-none">
                    <button
                        type="button"
                        onClick={() => router.back()}
                        className="inline-flex h-9 items-center justify-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent"
                    >
                        {t('common.cancel')}
                    </button>
                    <SubmitButton icon={Save} pendingText={t('common.saving')} size="h-9" pending={pending}>
                        {t('common.save')}
                    </SubmitButton>
                </div>
            </div>
        </form>
    );
}
