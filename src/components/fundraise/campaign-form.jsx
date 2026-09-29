'use client';
import { Save } from 'lucide-react';
import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { saveCampaign } from '@/app/actions/fundraise';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

/**
 * Create / edit a fundraise. `groups` is already narrowed to the groups this user may
 * create in; `allowNoGroup` is true only for app-level fundraise managers.
 */
export default function CampaignForm({ campaign = null, groups, allowNoGroup, cancelHref, locations = [], defaultPublic = false }) {
    const { t, locale } = useT();
    const [state, action, pending] = useActionState(saveCampaign, null);
    const fe = (name) => (state?.fieldErrors?.[name] ? t(state.fieldErrors[name]) : null);
    const c = campaign ?? {};
    const meta = c.meta ?? {};
    // Only on create — an existing fundraise's link is switched from its detail page.
    const [isPublic, setIsPublic] = useState(defaultPublic);

    // onSubmit + startTransition rather than <form action>: React resets uncontrolled
    // fields after a form action completes, which would wipe the input on a validation error.
    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
    };

    return (
        <form onSubmit={onSubmit} className="space-y-5">
            {c.id && <input type="hidden" name="id" value={c.id} />}
            <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t('fundraise.name')} error={fe('title')} required>
                    <input name="title" defaultValue={c.title ?? ''} maxLength={200} className={`${textInput(!!fe('title'))} w-full`} />
                </Field>
                <Field label={t('fundraise.nameGu')}>
                    <input name="title_gu" lang="gu" defaultValue={c.title_gu ?? ''} maxLength={200} className={`${textInput()} w-full`} />
                </Field>
                <Field label={t('fundraise.group')} error={fe('group_id')}>
                    <select
                        name="group_id"
                        defaultValue={c.group_id ?? (allowNoGroup ? '' : groups[0]?.id ?? '')}
                        className={`${selectInput(!!fe('group_id'))} w-full`}
                    >
                        {allowNoGroup && <option value="">{t('fundraise.noGroup')}</option>}
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                                {(locale === 'gu' && g.name_gu) || g.name}
                            </option>
                        ))}
                    </select>
                </Field>
                <Field label={t('fundraise.target')} error={fe('target_amount')} hint={t('common.optional')}>
                    <input
                        name="target_amount"
                        inputMode="decimal"
                        defaultValue={c.target_amount ?? ''}
                        className={`${textInput(!!fe('target_amount'))} w-full tabular-nums`}
                    />
                </Field>
                <Field label={t('fundraise.startDate')} error={fe('start_date')}>
                    <input type="date" name="start_date" defaultValue={c.start_date ?? ''} className={`${textInput(!!fe('start_date'))} w-full`} />
                </Field>
                <Field label={t('fundraise.endDate')} error={fe('end_date')}>
                    <input type="date" name="end_date" defaultValue={c.end_date ?? ''} className={`${textInput(!!fe('end_date'))} w-full`} />
                </Field>
                <Field label={t('fundraise.location')} hint={t('fundraise.locationHint')}>
                    <input name="location" list="fundraise-locations" maxLength={100} defaultValue={c.location ?? ''} className={`${textInput()} w-full`} />
                    {/* A datalist is fine here: free text is the point, the list is only suggestions. */}
                    <datalist id="fundraise-locations">
                        {locations.map((l) => (
                            <option key={l} value={l} />
                        ))}
                    </datalist>
                </Field>
                <Field label={t('fundraise.status')}>
                    <select name="status" defaultValue={c.status ?? 'active'} className={`${selectInput()} w-full`}>
                        {['active', 'draft', 'closed'].map((s) => (
                            <option key={s} value={s}>
                                {t(`fundraise.${s}`)}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>
            {!c.id && <Switch checked={isPublic} onChange={setIsPublic} name="is_public" label={t('fundraise.makePublic')} />}
            <Field label={t('fundraise.description')}>
                <textarea name="description" rows={4} defaultValue={meta.description ?? ''} className={`${textArea()} w-full`} />
            </Field>
            <Field label={t('fundraise.descriptionGu')}>
                <textarea name="description_gu" lang="gu" rows={4} defaultValue={meta.description_gu ?? ''} className={`${textArea()} w-full`} />
            </Field>
            {state?.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {t(state.error)}
                </p>
            )}
            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <Link
                    href={cancelHref}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent"
                >
                    {t('common.cancel')}
                </Link>
                <SubmitButton icon={Save} pendingText={t('common.saving')} pending={pending}>
                    {c.id ? t('common.save') : t('common.create')}
                </SubmitButton>
            </div>
        </form>
    );
}
