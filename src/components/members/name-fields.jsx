'use client';
import { Field, textInput } from '@/components/ui/field';
import GujaratiField from '@/components/ui/gujarati-field';
import { useAutoGujarati } from '@/components/ui/use-auto-gujarati';
import { useT } from '@/lib/i18n/client';
import { LOCAL_LANGUAGES } from '@/lib/local-language';

/**
 * A member's name in three required parts — first name, father's name, surname (Gujarati:
 * તમારું નામ / તમારા પિતાનું નામ / અટક) — each with its local-script twin, auto-filled from
 * the English and still editable. Posts first_name / middle_name / surname and their *_local;
 * the server joins each set into full_name / full_name_local. Renders siblings for the
 * caller's grid: the three English fields, then the three local ones.
 * optional: English parts that may stay empty (e.g. ['middle_name'] for an older relative whose
 * father's name is not known).
 * @param {{ member?: any, fe: (name: string) => string|null, optional?: string[] }} props
 */
export default function NameFields({ member, fe, optional = [] }) {
    const { t, localLang } = useT();
    const first = useAutoGujarati(member?.first_name ?? '', member?.first_name_local ?? '');
    const middle = useAutoGujarati(member?.middle_name ?? '', member?.middle_name_local ?? '');
    const surname = useAutoGujarati(member?.surname ?? '', member?.surname_local ?? '');
    const lang = LOCAL_LANGUAGES[localLang]?.label ?? '';

    const english = (name, labelKey, auto) => (
        <Field label={t(labelKey)} error={fe(name)} required={!optional.includes(name)}>
            <input name={name} required={!optional.includes(name)} maxLength={60} autoComplete="off" {...auto.enProps} className={`${textInput(!!fe(name))} w-full`} />
        </Field>
    );
    const local = (name, labelKey, auto) => <GujaratiField label={`${t(labelKey)} (${lang})`} name={name} auto={auto} maxLength={60} />;

    return (
        <>
            {english('first_name', 'members.firstName', first)}
            {english('middle_name', 'members.middleName', middle)}
            {english('surname', 'members.surname', surname)}
            {local('first_name_local', 'members.firstName', first)}
            {local('middle_name_local', 'members.middleName', middle)}
            {local('surname_local', 'members.surname', surname)}
        </>
    );
}
