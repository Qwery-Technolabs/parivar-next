'use client';
import { Field, textInput, translationPair } from '@/components/ui/field';
import GujaratiField from '@/components/ui/gujarati-field';
import { useAutoGujarati } from '@/components/ui/use-auto-gujarati';
import { useT } from '@/lib/i18n/client';
import { LOCAL_LANGUAGES } from '@/lib/local-language';
import { nameCase } from '@/lib/names';

/**
 * A member's name in three required parts — first name, father's name, surname (Gujarati:
 * તમારું નામ / તમારા પિતાનું નામ / અટક) — each with its local-script twin, auto-filled from
 * the English and still editable. Posts first_name / middle_name / surname and their *_local;
 * the server joins each set into full_name / full_name_local. Renders siblings for the
 * caller's grid: one shaded box per name part (English + its local twin).
 * optional: English parts that may stay empty (e.g. ['middle_name'] for an older relative whose
 * father's name is not known).
 * married: a married woman — the middle / surname fields become "Husband's name" / "Surname (in-laws)"
 * (her main, married name) and her maiden parts follow: father's name and father's surname
 * (posted as maiden_middle_name / maiden_surname + _local).
 * @param {{ member?: any, fe: (name: string) => string|null, optional?: string[], married?: boolean }} props
 */
export default function NameFields({ member, fe, optional = [], married = false }) {
    const { t, localLang } = useT();
    const first = useAutoGujarati(member?.first_name ?? '', member?.first_name_local ?? '', 'firstName');
    const middle = useAutoGujarati(member?.middle_name ?? '', member?.middle_name_local ?? '', married ? 'husbandName' : 'fatherName');
    const surname = useAutoGujarati(member?.surname ?? '', member?.surname_local ?? '', 'surname');
    const maidenMiddle = useAutoGujarati(member?.maiden_middle_name ?? '', member?.maiden_middle_name_local ?? '', 'fatherName');
    const maidenSurname = useAutoGujarati(member?.maiden_surname ?? '', member?.maiden_surname_local ?? '', 'surname');
    const lang = LOCAL_LANGUAGES[localLang]?.label ?? '';

    const english = (name, labelKey, auto) => (
        <Field label={`${t(labelKey)} (${t('lang.en')})`} error={fe(name)} required={!optional.includes(name)}>
            <input
                name={name}
                required={!optional.includes(name)}
                maxLength={60}
                autoComplete="off"
                autoCapitalize="words"
                {...auto.enProps}
                // Name Case on leaving the box ("MANTHAN" → "Manthan"); the server does the same when saving.
                onBlur={(e) => {
                    e.target.value = nameCase(e.target.value);
                    auto.enProps.onBlur?.(e);
                }}
                className={`${textInput(!!fe(name))} w-full`}
            />
        </Field>
    );
    const local = (name, labelKey, auto) => <GujaratiField label={`${t(labelKey)} (${lang})`} name={name} auto={auto} maxLength={60} />;

    // Each name part: its English box and its local twin together in one shaded box (which translation is whose).
    const pair = (name, labelKey, auto) => (
        <div key={name} className={`${translationPair} grid content-start gap-3`}>
            {english(name, labelKey, auto)}
            {local(`${name}_local`, labelKey, auto)}
        </div>
    );

    return (
        <>
            {pair('first_name', 'members.firstName', first)}
            {pair('middle_name', married ? 'members.husbandName' : 'members.middleName', middle)}
            {pair('surname', married ? 'members.inlawSurname' : 'members.surname', surname)}
            {married && (
                <>
                    {pair('maiden_middle_name', 'members.maidenFather', maidenMiddle)}
                    {pair('maiden_surname', 'members.maidenSurname', maidenSurname)}
                </>
            )}
        </>
    );
}
