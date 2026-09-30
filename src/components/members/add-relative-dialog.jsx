'use client';
import { Plus, UserPlus, UserRoundSearch } from 'lucide-react';
import { useState } from 'react';
import { addRelative } from '@/app/actions/family';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import NameFields from '@/components/members/name-fields';
import { useT } from '@/lib/i18n/client';

const KINDS = ['father', 'mother', 'spouse', 'brother', 'sister', 'son', 'daughter'];
const MARITAL = ['unmarried', 'married', 'engaged', 'widowed', 'divorced'];
const MALE_LINE = ['father', 'brother', 'son'];

/** Starting values for a new relative, from what we know about the person. */
function defaultsFor(kind, p) {
    const fromFather = kind === 'brother' || kind === 'sister';
    const child = kind === 'son' || kind === 'daughter';
    const ownSurname = !(kind === 'mother' || kind === 'spouse');
    return {
        first_name: kind === 'father' ? p.middle_name ?? '' : '',
        first_name_local: kind === 'father' ? p.middle_name_local ?? '' : '',
        middle_name: child ? p.first_name ?? '' : fromFather ? p.middle_name ?? '' : '',
        middle_name_local: child ? p.first_name_local ?? '' : fromFather ? p.middle_name_local ?? '' : '',
        surname: ownSurname ? p.surname ?? '' : '',
        surname_local: ownSurname ? p.surname_local ?? '' : '',
    };
}

/**
 * "+ Add" in the Family card header. Pick the relation first (father, mother, wife / husband,
 * brother, sister, son, daughter), then either pick someone already in the app — for father /
 * brother / son the search is limited to the person's surname — or enter a new person (name with
 * the local script filled in, optional phone → login, birth date, alive / late, marital status).
 * The popup stays open after each save, so a whole family can be added in one go.
 * `person`: { id, first_name, middle_name, surname, *_local, gender }; `filled`: { father, mother }.
 */
export default function AddRelativeDialog({ person, filled = {} }) {
    const { t } = useT();
    const [kind, setKind] = useState('');
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
                        <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} required className={`${selectInput(!!fieldError('kind'))} w-full`}>
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
                                    <div className="grid gap-3 sm:grid-cols-3">
                                        <NameFields member={defaultsFor(kind, person)} fe={fieldError} optional={['middle_name']} />
                                    </div>
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
                                                defaultValue={kind === 'father' || kind === 'mother' || kind === 'spouse' ? 'married' : 'unmarried'}
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
