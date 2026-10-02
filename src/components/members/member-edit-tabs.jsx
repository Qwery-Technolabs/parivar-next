'use client';
import { Briefcase, KeyRound, Save, ShieldCheck, UserRound, UsersRound } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useState } from 'react';
import { toast } from 'sonner';
import { updateMemberSection } from '@/app/actions/members';
import SubmitButton from '@/components/ui/submit-button';
import { AccessFields, BasicFields, CommunityFields, DetailFields, PasswordField } from './member-fields';
import { useT } from '@/lib/i18n/client';

/**
 * Edit-member page: one iconed tab per field group, each its own form and save, so changing
 * a phone number never re-submits (or trips over) the caste or password fields.
 * The open tab lives in ?tab= so a reload or shared link lands on it.
 * @param {{ member: any, roles: string[], canEdit?: boolean, canSetRole: boolean, canSetPassword: boolean, villages: string[], cities: string[], casteOptions: any, initialTab?: string }} props
 */
export default function MemberEditTabs({ member, roles, canEdit = true, canSetRole, canSetPassword, villages, cities, casteOptions, initialTab }) {
    const { t } = useT();
    const tabs = [
        canEdit && { key: 'basic', Icon: UserRound },
        canEdit && { key: 'community', Icon: UsersRound },
        canEdit && { key: 'details', Icon: Briefcase },
        canSetRole && { key: 'access', Icon: ShieldCheck },
        canSetPassword && { key: 'password', Icon: KeyRound },
    ].filter(Boolean);
    const [tab, setTab] = useState(tabs.some((x) => x.key === initialTab) ? initialTab : tabs[0]?.key);

    const open = (key) => {
        setTab(key);
        const url = new URL(window.location.href);
        url.searchParams.set('tab', key);
        window.history.replaceState(null, '', url);
    };

    return (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
            <MemberTabStrip tabs={tabs} tab={tab} onOpen={open} label={t('members.edit')} />
            {/* key={tab}: each tab mounts fresh, so its fields show what was last saved. */}
            <div role="tabpanel" id={`panel-${tab}`} aria-labelledby={`tab-${tab}`} className="p-3.5">
                <SectionForm key={tab} section={tab} member={member}>
                    {(fe) =>
                        tab === 'basic' ? (
                            <BasicFields member={member} fe={fe} villages={villages} cities={cities} />
                        ) : tab === 'community' ? (
                            <CommunityFields member={member} fe={fe} casteOptions={casteOptions} />
                        ) : tab === 'details' ? (
                            <DetailFields member={member} />
                        ) : tab === 'access' ? (
                            <AccessFields member={member} roles={roles} withStatus />
                        ) : (
                            <PasswordField fe={fe} required />
                        )
                    }
                </SectionForm>
            </div>
        </div>
    );
}

/** The member form's iconed tab strip — shared by the Edit page and the Add page. */
export function MemberTabStrip({ tabs, tab, onOpen, label }) {
    const { t } = useT();
    return (
        <div role="tablist" aria-label={label} className="flex overflow-x-auto border-b border-surface-border bg-card-head">
            {tabs.map(({ key, Icon }) => {
                const active = tab === key;
                return (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        id={`tab-${key}`}
                        aria-selected={active}
                        aria-controls={`panel-${key}`}
                        onClick={() => onOpen(key)}
                        className={`relative inline-flex shrink-0 items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium transition-colors ${
                            active ? 'text-primary' : 'text-ink-gray hover:text-primary'
                        }`}
                    >
                        <Icon className="size-4" />
                        {t(`members.tabs.${key}`)}
                        {active && <span aria-hidden className="absolute inset-x-2 bottom-0 h-0.75 rounded-t bg-brand-orange-strong" />}
                    </button>
                );
            })}
        </div>
    );
}

function SectionForm({ section, member, children }) {
    const { t } = useT();
    const router = useRouter();
    const [state, action, pending] = useActionState(async (prev, fd) => {
        const res = await updateMemberSection(prev, fd);
        if (res?.ok) {
            toast.success(t(res.message));
            router.refresh();
        }
        return res;
    }, null);
    const fe = (k) => (state?.fieldErrors?.[k] ? t(state.fieldErrors[k]) : null);

    // onSubmit + startTransition rather than <form action>: React resets uncontrolled
    // fields after a form action, which would wipe the input on a validation error.
    const onSubmit = (e) => {
        e.preventDefault();
        const form = e.currentTarget;
        const fd = new FormData(form);
        startTransition(() => action(fd));
        if (section === 'password') form.reset();
    };

    return (
        <form onSubmit={onSubmit} className="space-y-3">
            <input type="hidden" name="id" value={member.id} />
            <input type="hidden" name="section" value={section} />
            {children(fe)}
            {state?.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {t(state.error)}
                </p>
            )}
            <div className="flex justify-end border-t border-surface-border pt-3">
                <SubmitButton icon={Save} pendingText={t('common.saving')} size="h-9" pending={pending}>
                    {t('common.save')}
                </SubmitButton>
            </div>
        </form>
    );
}
