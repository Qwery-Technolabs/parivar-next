'use client';
import { Link2Off, Plus } from 'lucide-react';
import Link from 'next/link';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { addRelation, removeRelation } from '@/app/actions/members';
import { Card } from '@/components/shell/page-header';
import { Field, selectInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import PersonOrPhone from '@/components/ui/person-or-phone';
import { useT } from '@/lib/i18n/client';

function PersonRow({ person, label, onRemove, busy }) {
    const { locale } = useT();
    const name = (locale === 'gu' && person.full_name_local) || person.full_name;
    return (
        <li className="flex items-center gap-3 px-4 py-2.5">
            <span className="w-24 shrink-0 text-[11px] uppercase tracking-wide text-ink-gray">{label}</span>
            <Link href={`/members/${person.id}`} className="min-w-0 flex-1 break-words font-medium text-primary hover:underline">
                {name}
            </Link>
            {onRemove && (
                <button
                    type="button"
                    onClick={onRemove}
                    disabled={busy}
                    aria-label="Remove"
                    className="flex size-8 shrink-0 items-center justify-center rounded-md text-ink-gray hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                    <Link2Off className="size-4" />
                </button>
            )}
        </li>
    );
}

export default function FamilyCard({ personId, personName, family, canEdit, canInvite = false }) {
    const { t } = useT();
    const [busy, startTransition] = useTransition();

    const remove = (relativeId) => {
        if (!window.confirm(t('relations.remove') + '?')) return;
        startTransition(async () => {
            const res = await removeRelation(personId, relativeId);
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    };
    const rm = canEdit ? (id) => () => remove(id) : () => null;

    const rows = [
        ...(family.father ? [[family.father, t('relations.father')]] : []),
        ...(family.mother ? [[family.mother, t('relations.mother')]] : []),
        ...family.spouses.map((p) => [p, t('relations.spouse')]),
        ...family.children.map((p) => [p, t('relations.children')]),
    ];

    return (
        <Card
            title={t('members.family')}
            bodyClass=""
            actions={
                canEdit && (
                    <FormDialog
                        title={t('relations.add')}
                        description={personName}
                        action={addRelation}
                        hidden={{ person_id: personId }}
                        submitIcon={Plus}
                        width="sm:max-w-md"
                        trigger={({ open }) => (
                            <button
                                type="button"
                                onClick={open}
                                className="inline-flex h-8 items-center gap-1.5 btn-secondary rounded-md px-2.5 text-xs font-medium"
                            >
                                <Plus className="size-3.5" /> {t('relations.add')}
                            </button>
                        )}
                    >
                        {({ fieldError }) => (
                            <>
                                <Field label={t('relations.relation')} error={fieldError('relation')} required>
                                    <select name="relation" defaultValue="father" className={`${selectInput()} w-full`}>
                                        <option value="father">{t('relations.father')}</option>
                                        <option value="mother">{t('relations.mother')}</option>
                                        <option value="spouse">{t('relations.spouse')}</option>
                                        <option value="child">{t('relations.children')}</option>
                                    </select>
                                </Field>
                                {/* A relative who is not registered yet can be added by phone number (invited). */}
                                <PersonOrPhone fieldError={fieldError} pickerName="relative_id" exclude={[personId]} allowPhone={canInvite} />
                            </>
                        )}
                    </FormDialog>
                )
            }
        >
            {rows.length === 0 && family.siblings.length === 0 ? (
                <p className="px-4 py-5 text-sm text-ink-gray">{t('relations.empty')}</p>
            ) : (
                <ul className="divide-y divide-surface-border">
                    {rows.map(([p, label]) => (
                        <PersonRow key={`${label}-${p.id}`} person={p} label={label} onRemove={rm(p.id)} busy={busy} />
                    ))}
                    {/* Siblings are derived from shared parents — nothing to remove directly. */}
                    {family.siblings.map((p) => (
                        <PersonRow key={`sib-${p.id}`} person={p} label={t('relations.siblings')} />
                    ))}
                </ul>
            )}
        </Card>
    );
}
