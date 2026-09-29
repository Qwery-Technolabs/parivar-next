'use client';
import { Save } from 'lucide-react';
import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { saveCampaign } from '@/app/actions/fundraise';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import Switch from '@/components/ui/switch';
import BilingualName from '@/components/ui/bilingual-name';
import AudienceEditor from './audience-editor';
import { useT } from '@/lib/i18n/client';

/**
 * Create / edit a fundraise. Every fundraise belongs to a group: `groups` is already narrowed
 * to the groups this user may create in, and `defaultGroupId` preselects the one it started from.
 */
export default function CampaignForm({
    campaign = null,
    groups,
    defaultGroupId = null,
    cancelHref,
    locations = [],
    defaultPublic = false,
    audience = [],
    castes,
    suggestions,
}) {
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
        <form onSubmit={onSubmit} className="space-y-4">
            {c.id && <input type="hidden" name="id" value={c.id} />}
            {/* Status sits top-right: it is the first thing checked when reopening a fundraise. */}
            <div className="flex justify-end">
                <Field label={t('fundraise.status')} className="w-full sm:w-52">
                    <select name="status" defaultValue={c.status ?? 'active'} className={`${selectInput()} w-full`}>
                        {['active', 'draft', 'closed'].map((s) => (
                            <option key={s} value={s}>
                                {t(`fundraise.${s}`)}
                            </option>
                        ))}
                    </select>
                </Field>
            </div>
            {/* Full-width page: 4 columns on wide screens → the basics sit in two rows. */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <BilingualName
                    enLabel={t('fundraise.name')}
                    guLabel={t('fundraise.nameLocal')}
                    enName="title"
                    guName="title_local"
                    defaultEn={c.title}
                    defaultGu={c.title_local}
                    error={fe('title')}
                    maxLength={200}
                    required
                />
                <Field label={t('fundraise.group')} error={fe('group_id')}>
                    <select
                        name="group_id"
                        defaultValue={c.group_id ?? defaultGroupId ?? groups[0]?.id ?? ''}
                        className={`${selectInput(!!fe('group_id'))} w-full`}
                    >
                        {groups.map((g) => (
                            <option key={g.id} value={g.id}>
                                {(locale === 'gu' && g.name_local) || g.name}
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
                <Field label={t('fundraise.place')} hint={t('fundraise.placeHint')}>
                    <input name="location" list="fundraise-locations" maxLength={100} defaultValue={c.location ?? ''} className={`${textInput()} w-full`} />
                    {/* A datalist is fine here: free text is the point, the list is only suggestions. */}
                    <datalist id="fundraise-locations">
                        {locations.map((l) => (
                            <option key={l} value={l} />
                        ))}
                    </datalist>
                </Field>
            </div>
            <AudienceEditor defaultRows={audience} castes={castes} suggestions={suggestions} error={fe('audience')} />
            {!c.id && <Switch checked={isPublic} onChange={setIsPublic} name="is_public" label={t('fundraise.makePublic')} />}
            <div className="grid gap-3 lg:grid-cols-2">
                <BilingualName
                    enLabel={t('fundraise.description')}
                    guLabel={t('fundraise.descriptionLocal')}
                    enName="description"
                    guName="description_local"
                    defaultEn={meta.description}
                    defaultGu={meta.description_local}
                    maxLength={5000}
                    multiline
                />
            </div>
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
