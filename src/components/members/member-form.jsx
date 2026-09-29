'use client';
import { Save } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useState } from 'react';
import { toast } from 'sonner';
import { createMember, updateMember } from '@/app/actions/members';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import Switch from '@/components/ui/switch';
import BilingualName from '@/components/ui/bilingual-name';
import CasteSelect from './caste-select';
import { useT } from '@/lib/i18n/client';
import { BLOOD_GROUPS } from '@/lib/roles';

/**
 * @param {{ member?: any, roles: string[], canSetRole: boolean, canSetPassword: boolean, villages: string[], cities?: string[], casteOptions: any }} props
 */
export default function MemberForm({ member, roles, canSetRole, canSetPassword, villages, cities = [], casteOptions }) {
    const { t } = useT();
    const router = useRouter();
    const isEdit = Boolean(member);
    const [donor, setDonor] = useState(Boolean(member?.is_blood_donor));
    const [caste, setCaste] = useState({
        caste: member?.caste_id ? String(member.caste_id) : '',
        subcaste: member?.subcaste_id ? String(member.subcaste_id) : '',
    });
    const meta = member?.meta ?? {};

    const [state, action, pending] = useActionState(async (prev, fd) => {
        const res = await (isEdit ? updateMember : createMember)(prev, fd);
        if (res?.ok) {
            toast.success(t(res.message));
            router.push(`/members/${res.id}`);
        }
        return res;
    }, null);
    const fe = (k) => (state?.fieldErrors?.[k] ? t(state.fieldErrors[k]) : null);

    const section = 'rounded-lg border border-surface-border bg-white p-3.5 shadow-sm';
    // Full-width page: three columns on wide screens so the form is not one long scroll.
    const grid = 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3';

    // onSubmit + startTransition rather than <form action>: React resets uncontrolled
    // fields after a form action, which would wipe the input on a validation error.
    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
    };

    return (
        <form onSubmit={onSubmit} className="space-y-3">
            {isEdit && <input type="hidden" name="id" value={member.id} />}

            <section className={section}>
                <div className={grid}>
                    <BilingualName
                        enLabel={t('members.fullName')}
                        guLabel={t('members.fullNameLocal')}
                        enName="full_name"
                        guName="full_name_local"
                        defaultEn={member?.full_name}
                        defaultGu={member?.full_name_local}
                        error={fe('full_name')}
                        required
                    />
                    <Field label={t('members.phone')} hint={t('auth.phoneHint')} error={fe('phone')} required>
                        <input
                            name="phone"
                            type="tel"
                            inputMode="numeric"
                            defaultValue={member?.phone ?? ''}
                            required
                            className={`${textInput(!!fe('phone'))} w-full tabular-nums`}
                        />
                    </Field>
                    <Field label={t('members.village')}>
                        <input name="village" list="villages" defaultValue={member?.village ?? ''} maxLength={100} className={`${textInput()} w-full`} />
                        {/* A suggestion list only — the field accepts any village, so a datalist
                            is the right tool here, unlike a select-from-list control. */}
                        <datalist id="villages">
                            {villages.map((v) => (
                                <option key={v} value={v} />
                            ))}
                        </datalist>
                    </Field>
                    <Field label={t('members.city')} hint={t('members.cityHint')}>
                        <input name="city" list="cities" defaultValue={member?.city ?? ''} maxLength={100} className={`${textInput()} w-full`} />
                        <datalist id="cities">
                            {cities.map((c) => (
                                <option key={c} value={c} />
                            ))}
                        </datalist>
                    </Field>
                    <CasteSelect
                        options={casteOptions}
                        caste={caste.caste}
                        subcaste={caste.subcaste}
                        onChange={setCaste}
                        names={{ caste: 'caste_id', subcaste: 'subcaste_id' }}
                        errors={{ caste: fe('caste_id'), subcaste: fe('subcaste_id') }}
                        current={{
                            caste: member?.caste_id ? { value: String(member.caste_id), label: member.caste_name } : undefined,
                            subcaste: member?.subcaste_id ? { value: String(member.subcaste_id), label: member.subcaste_name } : undefined,
                        }}
                    />
                    <Field label={t('members.gender')}>
                        <select name="gender" defaultValue={member?.gender ?? ''} className={`${selectInput()} w-full`}>
                            <option value="">—</option>
                            <option value="male">{t('gender.male')}</option>
                            <option value="female">{t('gender.female')}</option>
                            <option value="other">{t('gender.other')}</option>
                        </select>
                    </Field>
                    <Field label={t('members.dob')}>
                        <input name="dob" type="date" defaultValue={member?.dob ?? ''} className={`${textInput()} w-full`} />
                    </Field>
                    <Field label={t('members.bloodGroup')}>
                        <select name="blood_group" defaultValue={member?.blood_group ?? ''} className={`${selectInput()} w-full`}>
                            <option value="">—</option>
                            {BLOOD_GROUPS.map((g) => (
                                <option key={g} value={g}>
                                    {g}
                                </option>
                            ))}
                        </select>
                    </Field>
                    <div className="flex flex-col justify-end pb-1">
                        <Switch checked={donor} onChange={setDonor} name="is_blood_donor" label={t('members.donor')} />
                        <span className="mt-1 text-xs text-ink-gray">{t('members.donorHint')}</span>
                    </div>
                    {canSetRole && (
                        <Field label={t('members.role')}>
                            <select name="role" defaultValue={member?.role ?? 'sabhyo'} className={`${selectInput()} w-full`}>
                                {roles.map((r) => (
                                    <option key={r} value={r}>
                                        {t(`roles.${r}`)}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    )}
                    {isEdit && canSetRole && (
                        <Field label={t('members.status')}>
                            <select name="status" defaultValue={member?.status ?? 'active'} className={`${selectInput()} w-full`}>
                                <option value="active">{t('status.active')}</option>
                                <option value="inactive">{t('status.inactive')}</option>
                                <option value="deceased">{t('status.deceased')}</option>
                            </select>
                        </Field>
                    )}
                    {isEdit && !canSetRole && <input type="hidden" name="status" value={member.status} />}
                </div>
            </section>

            <section className={section}>
                <h2 className="mb-3 text-sm font-semibold text-primary">{t('members.details')}</h2>
                <div className={grid}>
                    <Field label={t('members.position')} hint={t('members.positionHint')}>
                        <input name="position" defaultValue={meta.position ?? ''} maxLength={150} className={`${textInput()} w-full`} />
                    </Field>
                    <Field label={t('members.occupation')}>
                        <input name="occupation" defaultValue={meta.occupation ?? ''} className={`${textInput()} w-full`} />
                    </Field>
                    <Field label={t('members.education')}>
                        <input name="education" defaultValue={meta.education ?? ''} className={`${textInput()} w-full`} />
                    </Field>
                    <Field label={t('members.altPhone')}>
                        <input name="alt_phone" type="tel" defaultValue={meta.alt_phone ?? ''} className={`${textInput()} w-full tabular-nums`} />
                    </Field>
                    <Field label={t('members.email')}>
                        <input name="email" type="email" defaultValue={meta.email ?? ''} className={`${textInput()} w-full`} />
                    </Field>
                    <Field label={t('members.address')} className="sm:col-span-2 xl:col-span-3">
                        <textarea name="address" rows={2} defaultValue={meta.address ?? ''} className={`${textArea()} w-full`} />
                    </Field>
                    <Field label={t('members.bio')} className="sm:col-span-2 xl:col-span-3">
                        <textarea name="bio" rows={3} defaultValue={meta.bio ?? ''} className={`${textArea()} w-full`} />
                    </Field>
                </div>
            </section>

            {canSetPassword && (
                <section className={section}>
                    <h2 className="mb-3 text-sm font-semibold text-primary">{t('members.setPassword')}</h2>
                    <Field label={t('members.newPassword')} hint={t('members.passwordHint')} error={fe('password')} className="sm:max-w-sm">
                        <input
                            name="password"
                            type="password"
                            autoComplete="new-password"
                            minLength={6}
                            className={`${textInput(!!fe('password'))} w-full`}
                        />
                    </Field>
                </section>
            )}

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
