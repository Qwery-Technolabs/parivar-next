'use client';
import { Plus, UserPlus, UserRoundSearch } from 'lucide-react';
import { useState } from 'react';
import { addRelative } from '@/app/actions/family';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import MemberPicker from '@/components/ui/member-picker';
import NameFields from '@/components/members/name-fields';
import { useT } from '@/lib/i18n/client';

const MARITAL = ['unmarried', 'married', 'engaged', 'widowed', 'divorced'];
const MALE_LINE = ['father', 'brother', 'son'];

/**
 * "+ Add <father|mother|…>" on a person's Family page. Either pick someone already in the app —
 * for father / brother / son the search is limited to the person's surname — or enter a new
 * person: name (local script fills in by itself), optional phone (gives them a login), birth
 * date, alive / late, marital status (parents and spouses start as married).
 * `person`: { id, first_name, middle_name, surname, *_local, gender }.
 */
export default function AddRelativeDialog({ person, kind, label }) {
    const { t } = useT();
    const [mode, setMode] = useState('new');
    const maleLine = MALE_LINE.includes(kind);
    // Sensible starting values for a new person, from what we know about this one.
    const defaults = {
        first_name: kind === 'father' ? person.middle_name ?? '' : '',
        first_name_local: kind === 'father' ? person.middle_name_local ?? '' : '',
        middle_name: kind === 'son' || kind === 'daughter' ? person.first_name ?? '' : kind === 'brother' || kind === 'sister' ? person.middle_name ?? '' : '',
        middle_name_local:
            kind === 'son' || kind === 'daughter' ? person.first_name_local ?? '' : kind === 'brother' || kind === 'sister' ? person.middle_name_local ?? '' : '',
        surname: kind === 'mother' || kind === 'spouse' ? '' : person.surname ?? '',
        surname_local: kind === 'mother' || kind === 'spouse' ? '' : person.surname_local ?? '',
    };
    const maritalDefault = kind === 'father' || kind === 'mother' || kind === 'spouse' ? 'married' : 'unmarried';
    const modes = [
        { key: 'new', label: t('family.newPerson'), Icon: UserPlus },
        { key: 'member', label: t('family.pickMember'), Icon: UserRoundSearch },
    ];

    return (
        <FormDialog
            title={t('family.addKind', { kind: label })}
            action={addRelative}
            hidden={{ person_id: person.id, kind }}
            submitIcon={Plus}
            submitLabel={t('common.add')}
            width="sm:max-w-2xl"
            trigger={({ open }) => (
                <button
                    type="button"
                    onClick={open}
                    aria-label={t('family.addKind', { kind: label })}
                    title={t('family.addKind', { kind: label })}
                    className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
                >
                    <Plus className="size-3.5" /> <span className="hidden sm:inline">{t('common.add')}</span>
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    <input type="hidden" name="mode" value={mode} />
                    <div role="tablist" className="grid grid-cols-2 rounded-md border border-surface-border p-0.5">
                        {modes.map(({ key, label: l, Icon }) => (
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
                                <Icon className="size-3.5" /> {l}
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
                                name="relative_id"
                                exclude={[person.id]}
                                hasError={!!fieldError('relative_id')}
                                search={maleLine && person.surname ? { surname: person.surname, family: '1' } : { family: '1' }}
                            />
                        </Field>
                    ) : (
                        <>
                            <div className="grid gap-3 sm:grid-cols-3">
                                <NameFields member={defaults} fe={fieldError} optional={['middle_name']} />
                            </div>
                            <div className="grid gap-3 sm:grid-cols-2">
                                <Field label={t('family.phoneOptional')} hint={t('family.phoneHint')} error={fieldError('phone')}>
                                    <input name="phone" type="tel" inputMode="numeric" autoComplete="off" className={`${textInput(!!fieldError('phone'))} w-full tabular-nums`} />
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
                                    <select name="marital_status" defaultValue={maritalDefault} className={`${selectInput()} w-full`}>
                                        {MARITAL.map((m) => (
                                            <option key={m} value={m}>
                                                {t(`family.marital.${m}`)}
                                            </option>
                                        ))}
                                    </select>
                                </Field>
                            </div>
                        </>
                    )}
                </>
            )}
        </FormDialog>
    );
}
