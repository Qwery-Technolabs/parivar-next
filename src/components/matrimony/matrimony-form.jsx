'use client';
import { HeartHandshake } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { startTransition, useActionState, useEffect } from 'react';
import { toast } from 'sonner';
import { saveMatrimonyProfile } from '@/app/actions/matrimony';
import { Card } from '@/components/shell/page-header';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import { useT } from '@/lib/i18n/client';

const INCOMES = ['lt3', '3to6', '6to10', '10to20', 'gt20'];

/**
 * List / edit a matrimony profile: education & work (saved on the member too), height, income,
 * the family contact shown to other families, preferences and a short "about". `profile` is
 * getProfile(); `contact` is the suggested contact for a new listing.
 */
export default function MatrimonyForm({ profile, contact, castes }) {
    const { t } = useT();
    const router = useRouter();
    const [state, action, pending] = useActionState(saveMatrimonyProfile, null);
    const fe = (n) => (state?.fieldErrors?.[n] ? t(state.fieldErrors[n]) : null);
    const p = profile;

    useEffect(() => {
        if (state?.ok) {
            toast.success(t(state.message));
            router.push(`/matrimony/${p.id}`);
        }
    }, [state, router, p.id, t]);

    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
    };
    const input = (name, label, props = {}) => (
        <Field label={label} error={fe(name)} required={props.required}>
            <input name={name} defaultValue={props.defaultValue ?? p[name] ?? ''} {...props.attrs} required={props.required} className={`${textInput(!!fe(name))} w-full`} />
        </Field>
    );

    return (
        <form onSubmit={onSubmit} className="space-y-4">
            <input type="hidden" name="person_id" value={p.id} />
            <div className="grid gap-4 lg:grid-cols-2">
                <Card title={t('matrimony.sections.work')}>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {input('education', t('members.education'), { attrs: { maxLength: 150 } })}
                        {input('occupation', t('members.occupation'), { attrs: { maxLength: 150 } })}
                        {input('height_cm', t('matrimony.heightCm'), { attrs: { type: 'number', min: 100, max: 230, inputMode: 'numeric' } })}
                        <Field label={t('matrimony.income')}>
                            <select name="income_range" defaultValue={p.income_range ?? ''} className={`${selectInput()} w-full`}>
                                <option value="">—</option>
                                {INCOMES.map((i) => (
                                    <option key={i} value={i}>
                                        {t(`matrimony.incomes.${i}`)}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    </div>
                </Card>
                <Card title={t('matrimony.contact')}>
                    <p className="mb-3 text-xs text-ink-gray">{t('matrimony.contactHint')}</p>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {input('contact_name', t('matrimony.contactName'), { required: true, defaultValue: p.contact_name ?? contact.name, attrs: { maxLength: 150 } })}
                        {input('contact_phone', t('members.phone'), { required: true, defaultValue: p.contact_phone ?? contact.phone, attrs: { type: 'tel', inputMode: 'numeric' } })}
                    </div>
                </Card>
                <Card title={t('matrimony.sections.preferences')}>
                    <div className="grid gap-3 sm:grid-cols-2">
                        {input('pref_age_min', t('matrimony.ageMin'), { attrs: { type: 'number', min: 18, max: 80, inputMode: 'numeric' } })}
                        {input('pref_age_max', t('matrimony.ageMax'), { attrs: { type: 'number', min: 18, max: 80, inputMode: 'numeric' } })}
                        <Field label={t('members.caste')} error={fe('pref_caste_id')}>
                            <select name="pref_caste_id" defaultValue={p.pref_caste_id ? String(p.pref_caste_id) : ''} className={`${selectInput()} w-full`}>
                                <option value="">{t('common.any')}</option>
                                {castes.map((c) => (
                                    <option key={c.value} value={c.value}>
                                        {c.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        {input('pref_city', t('members.city'), { attrs: { maxLength: 100 } })}
                        <div className="sm:col-span-2">{input('pref_education', t('members.education'), { attrs: { maxLength: 150 } })}</div>
                    </div>
                </Card>
                <Card title={t('matrimony.about')}>
                    <textarea name="about" rows={6} maxLength={2000} defaultValue={p.about ?? ''} placeholder={t('matrimony.aboutHint')} className={`${textArea()} w-full`} />
                </Card>
            </div>
            {state?.error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">{t(state.error)}</p>}
            <div className="sticky bottom-0 z-10 -mx-2 -mb-3 flex flex-row gap-2 border-t border-surface-border bg-white/95 px-2 py-2.5 backdrop-blur *:flex-1 sm:-mx-3 sm:justify-end sm:px-3 sm:*:flex-none lg:-mx-4 lg:px-4">
                <Link href={`/matrimony/${p.id}`} className="inline-flex h-9 items-center justify-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent">
                    {t('common.cancel')}
                </Link>
                <SubmitButton icon={HeartHandshake} pendingText={t('common.saving')} pending={pending}>
                    {p.is_active ? t('common.save') : t('matrimony.list')}
                </SubmitButton>
            </div>
        </form>
    );
}
