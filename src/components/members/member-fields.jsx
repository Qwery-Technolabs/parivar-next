'use client';
import { useState } from 'react';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import Switch from '@/components/ui/switch';
import PickOrType from '@/components/ui/pick-or-type';
import CasteSelect from './caste-select';
import NameFields from './name-fields';
import { useT } from '@/lib/i18n/client';
import { BLOOD_GROUPS } from '@/lib/roles';

/*
 * The member form's field groups. The Add page shows them all in one form; the Edit page
 * gives each its own tab and save (actions/members.js updateMemberSection).
 * Every group takes `fe(name)` → translated field error or null.
 */

// Full-width page: three columns on wide screens so a group is not one long scroll.
export const FIELD_GRID = 'grid gap-3 sm:grid-cols-2 xl:grid-cols-3';

/** Name (first, father's, surname + local), phone, gender, birth date, native village, current city. */
export function BasicFields({ member, fe, villages = [], cities = [] }) {
    const relativeOnly = Boolean(member?.id) && !member?.phone;
    const { t } = useT();
    // A married (widowed / divorced) woman gets four name parts: husband's name + in-laws' surname, and her maiden parts.
    const [gender, setGender] = useState(member?.gender ?? '');
    const [marital, setMarital] = useState(member?.marital_status ?? '');
    const married = gender === 'female' && ['married', 'widowed', 'divorced'].includes(marital);
    return (
        <div className={FIELD_GRID}>
            {/* A family-tree relative without a number (member exists, no phone): phone and father's name optional. */}
            <NameFields
                member={member}
                fe={fe}
                married={married}
                optional={relativeOnly || married ? ['middle_name', 'maiden_middle_name', 'maiden_surname'] : []}
            />
            <Field label={t('members.phone')} hint={relativeOnly ? t('members.phoneGivesLogin') : t('auth.phoneHint')} error={fe('phone')} required={!relativeOnly}>
                <input
                    name="phone"
                    type="tel"
                    inputMode="numeric"
                    defaultValue={member?.phone ?? ''}
                    required={!relativeOnly}
                    className={`${textInput(!!fe('phone'))} w-full tabular-nums`}
                />
            </Field>
            <Field label={t('members.gender')}>
                <select name="gender" value={gender} onChange={(e) => setGender(e.target.value)} className={`${selectInput()} w-full`}>
                    <option value="">—</option>
                    <option value="male">{t('gender.male')}</option>
                    <option value="female">{t('gender.female')}</option>
                    <option value="other">{t('gender.other')}</option>
                </select>
            </Field>
            <Field label={t('members.dob')}>
                <input name="dob" type="date" defaultValue={member?.dob ?? ''} className={`${textInput()} w-full`} />
            </Field>
            <Field label={t('family.maritalStatus')}>
                <select name="marital_status" value={marital} onChange={(e) => setMarital(e.target.value)} className={`${selectInput()} w-full`}>
                    <option value="">—</option>
                    {['unmarried', 'married', 'engaged', 'widowed', 'divorced'].map((s) => (
                        <option key={s} value={s}>
                            {t(`family.marital.${s}`)}
                        </option>
                    ))}
                </select>
            </Field>
            <Field label={t('members.village')}>
                <PickOrType name="village" defaultValue={member?.village ?? ''} suggestions={villages} label={t('members.village')} />
            </Field>
            <Field label={t('members.city')} hint={t('members.cityHint')}>
                <PickOrType name="city" defaultValue={member?.city ?? ''} suggestions={cities} label={t('members.city')} />
            </Field>
        </div>
    );
}

/** Caste / sub-caste, blood group, donor switch. */
export function CommunityFields({ member, fe, casteOptions }) {
    const { t } = useT();
    const [donor, setDonor] = useState(Boolean(member?.is_blood_donor));
    const [caste, setCaste] = useState({
        caste: member?.caste_id ? String(member.caste_id) : '',
        subcaste: member?.subcaste_id ? String(member.subcaste_id) : '',
    });
    return (
        <div className={FIELD_GRID}>
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
        </div>
    );
}

/** Role (and, when editing, status). */
export function AccessFields({ member, roles, withStatus = false }) {
    const { t } = useT();
    return (
        <div className={FIELD_GRID}>
            <Field label={t('members.role')}>
                <select name="role" defaultValue={member?.role ?? 'sabhyo'} className={`${selectInput()} w-full`}>
                    {roles.map((r) => (
                        <option key={r} value={r}>
                            {t(`roles.${r}`)}
                        </option>
                    ))}
                </select>
            </Field>
            {withStatus && (
                <Field label={t('members.status')}>
                    <select name="status" defaultValue={member?.status ?? 'active'} className={`${selectInput()} w-full`}>
                        <option value="active">{t('status.active')}</option>
                        <option value="inactive">{t('status.inactive')}</option>
                        <option value="deceased">{t('status.deceased')}</option>
                    </select>
                </Field>
            )}
        </div>
    );
}

/** Position, occupation, education, contact, address, bio (users_listmeta). */
export function DetailFields({ member }) {
    const { t } = useT();
    const meta = member?.meta ?? {};
    return (
        <div className={FIELD_GRID}>
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
    );
}

export function PasswordField({ fe, required = false }) {
    const { t } = useT();
    return (
        <Field label={t('members.newPassword')} hint={t('members.passwordHint')} error={fe('password')} required={required} className="sm:max-w-sm">
            <input
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={6}
                required={required}
                className={`${textInput(!!fe('password'))} w-full`}
            />
        </Field>
    );
}
