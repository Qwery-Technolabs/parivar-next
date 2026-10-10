'use client';
import { Plus, UserPlus, UserRoundSearch } from 'lucide-react';
import { useState } from 'react';
import { addRelative } from '@/app/actions/family';
import { Field, selectInput, textInput, translationPair } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import GujaratiField from '@/components/ui/gujarati-field';
import { useAutoGujarati } from '@/components/ui/use-auto-gujarati';
import { useT } from '@/lib/i18n/client';
import { LOCAL_LANGUAGES } from '@/lib/local-language';
import { MARRIED_LIKE } from '@/lib/names';

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

/**
 * The person's own father: first name + surname. A married (widowed / divorced) woman's main middle name and
 * surname are her husband's and her in-laws' — her father is her maiden father's name + maiden surname.
 */
function ownFather(p) {
    const marriedWoman = p.gender === 'female' && MARRIED_LIKE.includes(p.marital_status);
    return marriedWoman
        ? {
              first: p.maiden_middle_name ?? '',
              firstLocal: p.maiden_middle_name_local ?? '',
              surname: p.maiden_surname ?? '',
              surnameLocal: p.maiden_surname_local ?? '',
          }
        : { first: p.middle_name ?? '', firstLocal: p.middle_name_local ?? '', surname: p.surname ?? '', surnameLocal: p.surname_local ?? '' };
}

function defaultsFor(kind, p, spouse) {
    const husbandOfPerson = p.gender === 'female' ? childFather(p, spouse) : null;
    // Father, mother, brother, sister share the person's father's side (a married woman's maiden side).
    const dad = ownFather(p);
    const fatherSide = ['father', 'mother', 'brother', 'sister'].includes(kind);
    const middle = {
        father: ['', ''],
        mother: [dad.first, dad.firstLocal],
        spouse: p.gender === 'female' ? ['', ''] : [p.first_name, p.first_name_local],
        brother: [dad.first, dad.firstLocal],
        sister: [dad.first, dad.firstLocal],
        son: p.gender === 'female' ? [husbandOfPerson?.first_name, husbandOfPerson?.first_name_local] : [p.first_name, p.first_name_local],
        daughter: p.gender === 'female' ? [husbandOfPerson?.first_name, husbandOfPerson?.first_name_local] : [p.first_name, p.first_name_local],
    }[kind] ?? ['', ''];
    const ownSurname = !(kind === 'spouse' && p.gender === 'female');
    return {
        first_name: kind === 'father' ? dad.first : '',
        first_name_local: kind === 'father' ? dad.firstLocal : '',
        middle_name: middle[0] ?? '',
        middle_name_local: middle[1] ?? '',
        surname: !ownSurname ? '' : fatherSide ? dad.surname : (p.surname ?? ''),
        surname_local: !ownSurname ? '' : fatherSide ? dad.surnameLocal : (p.surname_local ?? ''),
    };
}

/** A married woman's four name parts, worked out from the person: husband / in-laws, and her father's side. */
function marriedDefaultsFor(kind, p, spouse) {
    const base = { first_name: '', first_name_local: '', middle_name: '', middle_name_local: '', surname: '', surname_local: '' };
    if (kind === 'spouse')
        return {
            ...base,
            middle_name: p.first_name ?? '',
            middle_name_local: p.first_name_local ?? '',
            surname: p.surname ?? '',
            surname_local: p.surname_local ?? '',
        };
    if (kind === 'mother') {
        // Her husband is the person's father; her married surname is his.
        const dad = ownFather(p);
        return { ...base, middle_name: dad.first, middle_name_local: dad.firstLocal, surname: dad.surname, surname_local: dad.surnameLocal };
    }
    // daughter / sister: her father's side is known, her husband's is typed
    const father = kind === 'daughter' ? childFather(p, spouse) : null;
    // A sister's father is the person's own father (a married woman's maiden side).
    const dad = ownFather(p);
    return {
        ...base,
        maiden_middle_name: kind === 'sister' ? dad.first : (father?.first_name ?? ''),
        maiden_middle_name_local: kind === 'sister' ? dad.firstLocal : (father?.first_name_local ?? ''),
        maiden_surname: kind === 'sister' ? dad.surname : (father?.surname ?? ''),
        maiden_surname_local: kind === 'sister' ? dad.surnameLocal : (father?.surname_local ?? ''),
    };
}

const NAME_KEYS = [
    'first_name',
    'first_name_local',
    'middle_name',
    'middle_name_local',
    'surname',
    'surname_local',
    'maiden_middle_name',
    'maiden_middle_name_local',
    'maiden_surname',
    'maiden_surname_local',
];

/**
 * What was typed, for the other name form (marital status changed): the first name as is; a single woman's
 * father's name + surname become a married woman's maiden father's name + surname, and back. Only typed
 * (non-empty) values — the rest keep their suggestions.
 */
function carry(draft, toMarried) {
    const out = {};
    const put = (to, from) => {
        if (draft[from]) out[to] = draft[from];
    };
    put('first_name', 'first_name');
    put('first_name_local', 'first_name_local');
    const map = toMarried
        ? [
              ['maiden_middle_name', 'middle_name'],
              ['maiden_surname', 'surname'],
          ]
        : [
              ['middle_name', 'maiden_middle_name'],
              ['surname', 'maiden_surname'],
          ];
    for (const [to, from] of map) {
        put(to, from);
        put(`${to}_local`, `${from}_local`);
    }
    return out;
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
            <div
                key={name}
                className={shown ? `${translationPair} grid grid-cols-2 items-start content-start gap-2 sm:col-span-1 sm:grid-cols-1 sm:gap-1.5` : 'hidden'}
            >
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
            <input
                name={name}
                maxLength={60}
                autoComplete="off"
                {...(props.enProps ?? auto.enProps)}
                required={props.required}
                className={`${textInput(!!fe(name))} w-full`}
            />
        </Field>
    );
    return (
        <div className="space-y-3">
            <div className={`${translationPair} grid grid-cols-2 items-start gap-2 sm:gap-3`}>
                {en('first_name', 'members.firstName', first, { required: true, enProps: firstProps })}
                <GujaratiField label={`${t('members.firstName')} (${lang})`} name="first_name_local" auto={first} maxLength={60} />
            </div>
            {/* The rest of the name: hidden but posted, or shown to change. */}
            <div className={full ? 'grid gap-3 sm:grid-cols-2' : 'hidden'}>
                <div className={`${translationPair} grid grid-cols-2 items-start content-start gap-2 sm:grid-cols-1 sm:gap-3`}>
                    {en('middle_name', 'members.middleName', middle)}
                    <GujaratiField label={`${t('members.middleName')} (${lang})`} name="middle_name_local" auto={middle} maxLength={60} />
                </div>
                <div className={`${translationPair} grid grid-cols-2 items-start content-start gap-2 sm:grid-cols-1 sm:gap-3`}>
                    {en('surname', 'members.surname', surname, { required: full })}
                    <GujaratiField label={`${t('members.surname')} (${lang})`} name="surname_local" auto={surname} maxLength={60} />
                </div>
            </div>
            {!full && (
                <p className="flex flex-wrap items-center gap-x-2 text-xs text-ink-gray">
                    <span>
                        {t('family.fullName')}:{' '}
                        <b className="text-primary">{[firstEn || '…', defaults.middle_name, defaults.surname].filter(Boolean).join(' ')}</b>
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
    const { t, locale } = useT();
    const [kind, setKind] = useState('');
    const [marital, setMarital] = useState('unmarried');
    // Name parts typed so far: married ↔ not switches between two name forms; what was typed carries over.
    const [draft, setDraft] = useState({});
    const pickKind = (k) => {
        setKind(k);
        setDraft({});
        setMarital(k === 'father' || k === 'mother' || k === 'spouse' ? 'married' : 'unmarried');
    };
    // A woman who is (or was) married gets all four name parts: husband's name + in-laws' surname, father's name + surname.
    const female = ['mother', 'sister', 'daughter'].includes(kind) || (kind === 'spouse' && person.gender === 'male');
    const marriedWoman = female && ['married', 'widowed', 'divorced'].includes(marital);
    const [mode, setMode] = useState('new');
    const spouseKey = person.gender === 'female' ? 'husband' : person.gender === 'male' ? 'wife' : 'spouse';
    const labelOf = (k) => t(`family.one.${k === 'spouse' ? spouseKey : k}`);
    const maleLine = MALE_LINE.includes(kind);
    // The title names whose relative this is — and, once chosen, which one: "Add Mother of Nilesh Lallubhai Kanani".
    const personName = (locale !== 'en' && person.full_name_local) || person.full_name;
    const kindLabel = kind ? labelOf(kind) : '';
    const dialogTitle = kind
        ? t('family.addKindOf', { kind: locale === 'en' ? kindLabel.charAt(0).toUpperCase() + kindLabel.slice(1) : kindLabel, name: personName })
        : t('family.addTitleOf', { name: personName });
    const modes = [
        { key: 'new', label: t('family.newPerson'), Icon: UserPlus },
        { key: 'member', label: t('family.pickMember'), Icon: UserRoundSearch },
    ];

    return (
        <FormDialog
            title={dialogTitle}
            action={addRelative}
            hidden={{ person_id: person.id }}
            submitIcon={Plus}
            submitLabel={t('common.add')}
            width="sm:max-w-2xl"
            keepOpen
            // Next one: choose the relation again (father / mother may now be taken).
            onSuccess={() => {
                setKind('');
                setDraft({});
            }}
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
                        <select
                            name="kind"
                            value={kind}
                            onChange={(e) => pickKind(e.target.value)}
                            required
                            className={`${selectInput(!!fieldError('kind'))} w-full`}
                        >
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
                                <div
                                    key={kind}
                                    className="space-y-3"
                                    onChange={(e) => {
                                        const n = e.target?.name;
                                        if (NAME_KEYS.includes(n)) setDraft((d) => ({ ...d, [n]: e.target.value }));
                                    }}
                                >
                                    {marriedWoman ? (
                                        <MarriedName
                                            key={`${kind}-married`}
                                            defaults={{ ...marriedDefaultsFor(kind, person, spouse), ...carry(draft, true) }}
                                            fe={fieldError}
                                        />
                                    ) : (
                                        <QuickName
                                            key={`${kind}-single`}
                                            defaults={{ ...defaultsFor(kind, person, spouse), ...carry(draft, false) }}
                                            fe={fieldError}
                                        />
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
