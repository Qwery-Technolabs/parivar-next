'use client';
import { ShieldCheck, ShieldOff, UserMinus, UserPlus } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { addGroupMember, removeGroupMember, setGroupMemberRole } from '@/app/actions/groups';
import Badge from '@/components/ui/badge';
import { Field, selectInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { useT } from '@/lib/i18n/client';
import { formatPhone } from '@/lib/phone';

export default function GroupMembers({ groupId, members, canManage, currentUserId }) {
    const { t, locale } = useT();
    const [pending, startTransition] = useTransition();

    const run = (fn) =>
        startTransition(async () => {
            const res = await fn();
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });

    return (
        <section className="min-w-0">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-sm font-semibold text-primary">
                    {t('groups.members')} <span className="font-normal text-ink-gray tabular-nums">({members.length})</span>
                </h2>
                {canManage && (
                    <FormDialog
                        title={t('groups.addMember')}
                        action={addGroupMember}
                        hidden={{ group_id: groupId }}
                        submitIcon={UserPlus}
                        width="sm:max-w-md"
                        trigger={({ open }) => (
                            <button
                                type="button"
                                onClick={open}
                                className="inline-flex h-9 shrink-0 items-center gap-2 rounded-md border border-surface-border bg-white px-3 text-sm font-medium text-primary hover:bg-accent"
                            >
                                <UserPlus className="size-4 text-ink-gray" /> {t('groups.addMember')}
                            </button>
                        )}
                    >
                        {({ fieldError }) => (
                            <>
                                <Field label={t('relations.person')} error={fieldError('user_id')} required>
                                    <MemberPicker name="user_id" exclude={members.map((m) => m.id)} hasError={!!fieldError('user_id')} />
                                </Field>
                                <Field label={t('members.role')}>
                                    <select name="member_role" defaultValue="member" className={`${selectInput()} w-full`}>
                                        <option value="member">{t('groups.member')}</option>
                                        <option value="admin">{t('groups.admin')}</option>
                                    </select>
                                </Field>
                            </>
                        )}
                    </FormDialog>
                )}
            </div>
            <div className={pending ? 'cursor-wait opacity-70' : ''}>
                <TableShell>
                    <THead>
                        <Th>{t('members.fullName')}</Th>
                        <Th className="hidden sm:table-cell">{t('members.phone')}</Th>
                        <Th>{t('members.role')}</Th>
                        {canManage && (
                            <Th className="w-12">
                                <span className="sr-only">{t('common.actions')}</span>
                            </Th>
                        )}
                    </THead>
                    <tbody>
                        {members.length === 0 && <EmptyRow colSpan={4}>{t('groups.noMembers')}</EmptyRow>}
                        {members.map((m) => (
                            <Tr key={m.id}>
                                <Td className="max-w-64">
                                    <Link href={`/members/${m.id}`} className="font-medium text-primary hover:underline">
                                        {(locale === 'gu' && m.full_name_gu) || m.full_name}
                                    </Link>
                                    {m.village && <span className="block text-xs text-ink-gray">{m.village}</span>}
                                </Td>
                                <Td className="hidden whitespace-nowrap tabular-nums sm:table-cell">{formatPhone(m.phone)}</Td>
                                <Td>
                                    {m.member_role === 'admin' ? (
                                        <Badge tone="orange">
                                            <ShieldCheck className="size-3" /> {t('groups.admin')}
                                        </Badge>
                                    ) : (
                                        <Badge tone="gray">{t('groups.member')}</Badge>
                                    )}
                                </Td>
                                {canManage && (
                                    <Td className="text-right">
                                        <KebabMenu label={t('common.more')}>
                                            {(close) => (
                                                <>
                                                    {m.member_role === 'admin' ? (
                                                        <MenuItem
                                                            icon={ShieldOff}
                                                            disabled={m.id === currentUserId}
                                                            onClick={() => {
                                                                close();
                                                                run(() => setGroupMemberRole(groupId, m.id, 'member'));
                                                            }}
                                                        >
                                                            {t('groups.removeAdmin')}
                                                        </MenuItem>
                                                    ) : (
                                                        <MenuItem
                                                            icon={ShieldCheck}
                                                            onClick={() => {
                                                                close();
                                                                run(() => setGroupMemberRole(groupId, m.id, 'admin'));
                                                            }}
                                                        >
                                                            {t('groups.makeAdmin')}
                                                        </MenuItem>
                                                    )}
                                                    <MenuSeparator />
                                                    <MenuItem
                                                        icon={UserMinus}
                                                        danger
                                                        disabled={m.id === currentUserId}
                                                        onClick={() => {
                                                            close();
                                                            if (window.confirm(`${t('groups.removeMember')}?`))
                                                                run(() => removeGroupMember(groupId, m.id));
                                                        }}
                                                    >
                                                        {t('groups.removeMember')}
                                                    </MenuItem>
                                                </>
                                            )}
                                        </KebabMenu>
                                    </Td>
                                )}
                            </Tr>
                        ))}
                    </tbody>
                </TableShell>
            </div>
        </section>
    );
}
