'use client';
import { Plus, Send, Smartphone, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { inviteMembers } from '@/app/actions/members';
import { textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import GroupChecklist from '@/components/ui/group-checklist';
import { useT } from '@/lib/i18n/client';

const MAX_ROWS = 50;

/**
 * "Invite by phone" on the Members page: rows of mobile number + name, as many as needed,
 * and optionally groups to join. First password = the number (actions/members.js inviteMembers).
 * @param {{ groups: Array<{ value: string, label: string }> }} props
 */
export default function InviteMembersDialog({ groups }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('members.invite.title')}
            description={t('members.invite.description')}
            action={inviteMembers}
            submitIcon={Send}
            submitLabel={t('members.invite.submit')}
            width="sm:max-w-xl"
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    className="btn-secondary inline-flex h-9 flex-1 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium sm:flex-none"
                >
                    <Smartphone className="size-4" /> {t('members.invite.button')}
                </button>
            )}
        >
            {() => <InviteRows groups={groups} />}
        </FormDialog>
    );
}

function InviteRows({ groups }) {
    const { t } = useT();
    const next = useRef(1);
    const [rows, setRows] = useState([0]);
    const add = () => {
        if (rows.length >= MAX_ROWS) return;
        const id = next.current++;
        setRows((r) => [...r, id]);
        // Focus the new row's number once it renders.
        requestAnimationFrame(() => document.getElementById(`invite-phone-${id}`)?.focus());
    };

    return (
        <>
            <div className="space-y-2">
                <div className="hidden grid-cols-[1fr_1.4fr_2rem] gap-2 text-xs font-medium text-ink-gray sm:grid">
                    <span>{t('members.invite.phone')}</span>
                    <span>{t('members.invite.name')}</span>
                </div>
                {rows.map((id, i) => (
                    <div key={id} className="grid grid-cols-[1fr_2rem] gap-2 sm:grid-cols-[1fr_1.4fr_2rem]">
                        <input
                            id={`invite-phone-${id}`}
                            name="phone"
                            type="tel"
                            inputMode="numeric"
                            placeholder={t('members.invite.phone')}
                            aria-label={`${t('members.invite.phone')} ${i + 1}`}
                            className={`${textInput()} w-full min-w-0 tabular-nums`}
                        />
                        <button
                            type="button"
                            onClick={() => setRows((r) => (r.length > 1 ? r.filter((x) => x !== id) : r))}
                            disabled={rows.length === 1}
                            aria-label={t('members.invite.removeRow')}
                            className="order-last flex size-9 items-center justify-center rounded-md text-ink-gray hover:bg-accent hover:text-destructive disabled:opacity-30 sm:order-none sm:col-start-3 sm:row-start-1"
                        >
                            <X className="size-4" />
                        </button>
                        <input
                            name="full_name"
                            maxLength={150}
                            placeholder={t('members.invite.name')}
                            aria-label={`${t('members.invite.name')} ${i + 1}`}
                            className={`${textInput()} col-span-2 w-full min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1`}
                        />
                    </div>
                ))}
                <button
                    type="button"
                    onClick={add}
                    disabled={rows.length >= MAX_ROWS}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary hover:bg-accent disabled:opacity-50"
                >
                    <Plus className="size-4" /> {t('members.invite.addRow')}
                </button>
            </div>
            {groups.length > 0 && <GroupChecklist groups={groups} label={t('members.invite.groups')} />}
        </>
    );
}
