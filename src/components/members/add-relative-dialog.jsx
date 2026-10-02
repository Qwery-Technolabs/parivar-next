'use client';
import { Plus, UserPlus, UserRoundSearch } from 'lucide-react';
import { useState } from 'react';
import { addRelative } from '@/app/actions/family';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import GujaratiField from '@/components/ui/gujarati-field';
import { useAutoGujarati } from '@/components/ui/use-auto-gujarati';
import { useT } from '@/lib/i18n/client';
import { LOCAL_LANGUAGES } from '@/lib/local-language';

const KINDS = ['father', 'mother', 'spouse', 'brother', 'sister', 'son', 'daughter'];
const MARITAL = ['unmarried', 'married', 'engaged', 'widowed', 'divorced'];
const MALE_LINE = ['father', 'brother', 'son'];

/**
 * A new relative's name, worked out from the person so only the first name is typed:
 *   surname      — the person's (the family name; a husband's is typed)
 *   father's / husband's name (middle) —
 *     father: unknown (optional) · mother: her husband = the person's father (person's middle name)
 *     wife: the person · husband: typed · brother / sister: the person's father
 *     son / daughter: the person if a man, else her husband (the person's spouse)
 *   first name   — only a father's is known (the person's middle name)
 */
/** The father of the person's child: the person (a man), or a woman's husband — linked, else from her married name. */
function childFather(p, spouse) {
    if (p.gender !== 'female') return p;
    return spouse ?? { first_name: p.middle_name, first_name_local: p.middle_name_local, surname: p.surname, surname_local: p.surname_local };
}

function defaultsFor(kind, p, spouse) {
    const husbandOfPerson = p.gender === 'female' ? childFather(p, spouse) : null;
    const middle = {
        father: ['', ''],
        mother: [p.middle_name, p.middle_name_local],
        spouse: p.gender === 'female' ? ['', ''] : [p.first_name, p.first_name_local],
        brother: [p.middle_name, p.middle_name_local],
        sister: [p.middle_name, p.middle_name_local],
        son: p.gender === 'female' ? [husbandOfPerson?.first_name, husbandOfPerson?.first_name_local] : [p.first_name, p.first_name_local],
        daughter: p.gender === 'female' ? [husbandOfPerson?.first_name, husbandOfPerson?.first_name_local] : [p.first_name, p.first_name_local],
    }[kind] ?? ['', ''];
    const ownSurname = !(kind === 'spouse' && p.gender === 'female');
    return {
        first_name: kind === 'father' ? p.middle_name ?? '' : '',
        first_name_local: kind === 'father' ? p.middle_name_local ?? '' : '',
        middle_name: middle[0] ?? '',
        middle_name_local: middle[1] ?? '',
        surname: ownSurname ? p.surname ?? '' : '',
        surname_local: ownSurname ? p.surname_local ?? '' : '',
    };
}

/** A married woman's four name parts, worked out from the person: husband / in-laws, and her father's side. */
function marriedDefaultsFor(kind, p, spouse) {
    const base = { first_name: '', first_name_local: '', middle_name: '', middle_name_local: '', surname: '', surname_local: '' };
    if (kind === 'spouse') return { ...base, middle_name: p.first_name ?? '', middle_name_local: p.first_name_local ?? '', surname: p.surname ?? '', surname_local: p.surname_local ?? '' };
    if (kind === 'mother') return { ...base, middle_name: p.middle_name ?? '', middle_name_local: p.middle_name_local ?? '', surname: p.surname ?? '', surname_local: p.surname_local ?? '' };
    // daughter / sister: her father's side is known, her husband's is typed
    const father = kind === 'daughter' ? childFather(p, spouse) : null;
    return {
        ...base,
        maiden_middle_name: kind === 'sister' ? p.middle_name ?? '' : father?.first_name ?? '',
        maiden_middle_name_local: kind === 'sister' ? p.middle_name_local ?? '' : father?.first_name_local ?? '',
        maiden_surname: kind === 'sister' ? p.surname ?? '' : father?.surname ?? '',
        maiden_surname_local: kind === 'sister' ? p.surname_local ?? '' : father?.surname_local ?? '',
    };
}

/**
 * A married woman's name in the popup: only what is NOT known is asked. Her first name always;
 * husband's name / in-laws' surname / father's name / father's surname only when the person does
 * not already tell us (e.g. a daughter's father is the person, a wife's husband is the person).
 * Known parts post as hidden fields, previewed in one line with "Change" to show them all.
 */
function MarriedName({ defaults, fe }) {
    const { t, localLang } = useT();
    const lang = LOCAL_LANGUAGES[localLang]?.label ?? '';
    const parts = {
        first_name: useAutoGujarati(defaults.first_name ?? '', defaults.first_name_local ?? '', 'firstName'),
        middle_name: useAutoGujarati(defaults.middle_name ?? '', defaults.middle_name_local ?? '', 'fatherName'),
        surname: useAutoGujarati(defaults.surname ?? '', defaults.surname_local ?? '', 'surname'),
        maiden_middle_name: useAutoGujarati(defaults.maiden_middle_name ?? '', defaults.maiden_middle_name_local ?? '', 'fatherName'),
        maiden_surname: useAutoGujarati(defaults.maiden_surname ?? '', defaults.maiden_surname_local ?? '', 'surname'),
    };
    const labels = {
        first_name: 'members.firstName',
        middle_name: 'members.husbandName',
        surname: 'members.inlawSurname',
        maiden_middle_name: 'members.maidenFather',
        maiden_surname: 'members.maidenSurname',
    };
    const known = (name) => name !== 'first_name' && Boolean(defaults[name]);
    const hasError = Object.keys(labels).some((n) => known(n) && fe(n));
    const [full, setFull] = useState(hasError);
    const field = (name) => {
        const shown = full || !known(name);
        return (
            <div key={name} className={shown ? 'grid gap-1.5 sm:col-span-1' : 'hidden'}>
                <Field label={`${t(labels[name])} (${t('lang.en')})`} error={fe(name)} required={name === 'first_name' || name === 'surname'}>
                    <input
                        name={name}
                        maxLength={60}
                        autoComplete="off"
                        {...parts[name].enProps}
                        required={shown && (name === 'first_name' || name === 'surname')}
                        className={`${textInput(!!fe(name))} w-full`}
                    />
                </Field>
                <GujaratiField label={`${t(labels[name])} (${lang})`} name={`${name}_local`} auto={parts[name]} maxLength={60} />
            </div>
        );
    };
    const preview = [
        known('maiden_middle_name') || known('maiden_surname')
            ? `${t('members.maidenFather')}: ${[defaults.maiden_middle_name, defaults.maiden_surname].filter(Boolean).join(' ')}`
            : null,
        known('middle_name') || known('surname') ? `${t('members.husbandName')}: ${[defaults.middle_name, defaults.surname].filter(Boolean).join(' ')}` : null,
    ].filter(Boolean);
    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-3">{Object.keys(labels).map(field)}</div>
            {!full && preview.length > 0 && (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-gray">
                    <span className="text-primary">{preview.join(' · ')}</span>
                    <button type="button" onClick={() => setFull(true)} className="font-medium text-primary underline">
                        {t('family.change')}
                    </button>
                </p>
            )}
        </div>
    );
}

/**
 * Name for a new relative: just the first name (its local spelling fills in), with the full
 * name previewed. Father's name and surname come from defaultsFor and post as hidden fields;
 * "Change surname / father's name" shows them. Shown straight away when the surname is unknown.
 */
function QuickName({ defaults, fe }) {
    const { t, localLang } = useT();
    const first = useAutoGujarati(defaults.first_name, defaults.first_name_local, 'firstName');
    const middle = useAutoGujarati(defaults.middle_name, defaults.middle_name_local, 'fatherName');
    const surname = useAutoGujarati(defaults.surname, defaults.surname_local, 'surname');
    const [firstEn, setFirstEn] = useState(defaults.first_name);
    const [full, setFull] = useState(!defaults.surname || Boolean(fe('surname') || fe('middle_name')));
    const lang = LOCAL_LANGUAGES[localLang]?.label ?? '';
    const firstProps = { ...first.enProps, onChange: (e) => (first.enProps.onChange(e), setFirstEn(e.target.value)) };
    const en = (name, label, auto, props = {}) => (
        <Field label={`${t(label)} (${t('lang.en')})`} error={fe(name)} required={props.required}>
            <input name={name} maxLength={60} autoComplete="off" {...(props.enProps ?? auto.enProps)} required={props.required} className={`${textInput(!!fe(name))} w-full`} />
        </Field>
    );
    return (
        <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
                {en('first_name', 'members.firstName', first, { required: true, enProps: firstProps })}
                <GujaratiField label={`${t('members.firstName')} (${lang})`} name="first_name_local" auto={first} maxLength={60} />
            </div>
            {/* The rest of the name: hidden but posted, or shown to change. */}
            <div className={full ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}>
                {en('middle_name', 'members.middleName', middle)}
                {en('surname', 'members.surname', surname, { required: full })}
                <GujaratiField label={`${t('members.middleName')} (${lang})`} name="middle_name_local" auto={middle} maxLength={60} />
                <GujaratiField label={`${t('members.surname')} (${lang})`} name="surname_local" auto={surname} maxLength={60} />
            </div>
            {!full && (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-gray">
                    <span>
                        {t('family.fullName')}: <b className="text-primary">{[firstEn || '…', defaults.middle_name, defaults.surname].filter(Boolean).join(' ')}</b>
                    </span>
                    <button type="button" onClick={() => setFull(true)} className="font-medium text-primary underline">
                        {t('family.changeName')}
                    </button>
                </p>
            )}
        </div>
    );
}

/**
 * "+ Add" in the Family card header. Pick the relation first (father, mother, wife / husband,
 * brother, sister, son, daughter), then either pick someone already in the app — for father /
 * brother / son the search is limited to the person's surname — or enter a new person (name with
 * the local script filled in, optional phone → login, birth date, alive / late, marital status).
 * The popup stays open after each save, so a whole family can be added in one go.
 * `person`: { id, first_name, middle_name, surname, *_local, gender }; `filled`: { father, mother }.
 */
export default function AddRelativeDialog({ person, filled = {}, spouse = null }) {
    const { t } = useT();
    const [kind, setKind] = useState('');
    const [marital, setMarital] = useState('unmarried');
    const pickKind = (k) => {
        setKind(k);
        setMarital(k === 'father' || k === 'mother' || k === 'spouse' ? 'married' : 'unmarried');
    };
    // A woman who is (or was) married gets all four name parts: husband's name + in-laws' surname, father's name + surname.
    const female = ['mother', 'sister', 'daughter'].includes(kind) || (kind === 'spouse' && person.gender === 'male');
    const marriedWoman = female && ['married', 'widowed', 'divorced'].includes(marital);
    const [mode, setMode] = useState('new');
    const spouseKey = person.gender === 'female' ? 'husband' : person.gender === 'male' ? 'wife' : 'spouse';
    const labelOf = (k) => t(`family.one.${k === 'spouse' ? spouseKey : k}`);
    const maleLine = MALE_LINE.includes(kind);
    const modes = [
        { key: 'new', label: t('family.newPerson'), Icon: UserPlus },
        { key: 'member', label: t('family.pickMember'), Icon: UserRoundSearch },
    ];

    return (
        <FormDialog
            title={t('family.addTitle')}
            action={addRelative}
            hidden={{ person_id: person.id }}
            submitIcon={Plus}
            submitLabel={t('common.add')}
            width="sm:max-w-2xl"
            keepOpen
            // Next one: choose the relation again (father / mother may now be taken).
            onSuccess={() => setKind('')}
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={() => {
                        setKind('');
                        open();
                    }}
                    aria-label={t('family.addTitle')}
                    title={t('family.addTitle')}
                    className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
                >
                    <Plus className="size-3.5" /> <span className="hidden sm:inline">{t('common.add')}</span>
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    <Field label={t('family.relation')} hint={t('family.relationHint')} error={fieldError('kind')} required>
                        <select name="kind" value={kind} onChange={(e) => pickKind(e.target.value)} required className={`${selectInput(!!fieldError('kind'))} w-full`}>
                            <option value="" disabled>
                                {t('family.chooseRelation')}
                            </option>
                            {KINDS.map((k) => (
                                <option key={k} value={k} disabled={(k === 'father' || k === 'mother') && filled[k]}>
                                    {labelOf(k)}
                                </option>
                            ))}
                        </select>
                    </Field>

                    {kind && (
                        <>
                            <input type="hidden" name="mode" value={mode} />
                            <div role="tablist" className="grid grid-cols-2 rounded-md border border-surface-border p-0.5">
                                {modes.map(({ key, label, Icon }) => (
                                    <button
                                        key={key}
                                        type="button"
                                        role="tab"
                                        aria-selected={mode === key}
                                        onClick={() => setMode(key)}
                                        className={`inline-flex h-8 items-center justify-center gap-1.5 rounded text-xs font-medium ${
                                            mode === key ? 'seg-active' : 'text-ink-gray hover:text-primary'
                                        }`}
                                    >
                                        <Icon className="size-3.5" /> {label}
                                    </button>
                                ))}
                            </div>

                            {mode === 'member' ? (
                                <Field
                                    label={t('relations.person')}
                                    hint={maleLine && person.surname ? t('family.surnameOnly', { surname: person.surname }) : t('family.anyMember')}
                                    error={fieldError('relative_id')}
                                    required
                                >
                                    <MemberPicker
                                        key={kind}
                                        name="relative_id"
                                        exclude={[person.id]}
                                        hasError={!!fieldError('relative_id')}
                                        search={maleLine && person.surname ? { surname: person.surname, family: '1' } : { family: '1' }}
                                    />
                                </Field>
                            ) : (
                                // key: switching the relation refills the suggested names.
                                <div key={kind} className="space-y-3">
                                    {marriedWoman ? (
                                        <MarriedName key={`${kind}-married`} defaults={marriedDefaultsFor(kind, person, spouse)} fe={fieldError} />
                                    ) : (
                                        <QuickName key={`${kind}-single`} defaults={defaultsFor(kind, person, spouse)} fe={fieldError} />
                                    )}
                                    <div className="grid gap-3 sm:grid-cols-2">
                                        <Field label={t('family.phoneOptional')} hint={t('family.phoneHint')} error={fieldError('phone')}>
                                            <input
                                                name="phone"
                                                type="tel"
                                                inputMode="numeric"
                                                autoComplete="off"
                                                className={`${textInput(!!fieldError('phone'))} w-full tabular-nums`}
                                            />
                                        </Field>
                                        <Field label={t('members.dob')} error={fieldError('dob')}>
                                            <input name="dob" type="date" className={`${textInput(!!fieldError('dob'))} w-full`} />
                                        </Field>
                                        <Field label={t('family.alive')}>
                                            <select name="alive" defaultValue="alive" className={`${selectInput()} w-full`}>
                                                <option value="alive">{t('family.aliveYes')}</option>
                                                <option value="late">{t('family.late')}</option>
                                            </select>
                                        </Field>
                                        <Field label={t('family.maritalStatus')}>
                                            <select
                                                name="marital_status"
                                                value={marital}
                                                onChange={(e) => setMarital(e.target.value)}
                                                className={`${selectInput()} w-full`}
                                            >
                                                {MARITAL.map((m) => (
                                                    <option key={m} value={m}>
                                                        {t(`family.marital.${m}`)}
                                                    </option>
                                                ))}
                                            </select>
                                        </Field>
                                    </div>
                                </div>
                            )}
                        </>
                    )}
                </>
            )}
        </FormDialog>
    );
}
