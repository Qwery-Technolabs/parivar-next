'use client';
import { Save } from 'lucide-react';
import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { saveCampaign } from '@/app/actions/fundraise';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import GroupChecklist from '@/components/ui/group-checklist';
import PickOrType from '@/components/ui/pick-or-type';
import SubmitButton from '@/components/ui/submit-button';
import Switch from '@/components/ui/switch';
import BilingualName from '@/components/ui/bilingual-name';
import AudienceEditor from './audience-editor';
import { useT } from '@/lib/i18n/client';

/**
 * Create / edit a fundraise. Every fundraise belongs to a group: `groups` is already narrowed
 * to the groups this user may create in, and `defaultGroupId` preselects the one it started from.
 * It can also be shown in more groups (`otherGroups`: { id, name, name_local, locked } — locked =
 * already linked, but the user may not remove it).
 * Status sits above the card, top-right: the first thing checked when reopening a fundraise.
 */
export default function CampaignForm({
    campaign = null,
    groups,
    defaultGroupId = null,
    otherGroups = [],
    allowNoGroup = false,
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

    const groupName = (g) => (locale === 'gu' && g.name_local) || g.name;

    return (
        <form onSubmit={onSubmit} className="space-y-3">
            {c.id && <input type="hidden" name="id" value={c.id} />}
            {/* Status above the cards, top-right: the first thing checked when reopening a fundraise. */}
            <div className="flex justify-end">
                <label className="flex w-full items-center gap-2 sm:w-auto">
                    <span className="shrink-0 text-xs font-medium text-ink-gray">{t('fundraise.status')}</span>
                    <select name="status" defaultValue={c.status ?? 'active'} className={`${selectInput()} w-full sm:w-44`}>
                        {['active', 'draft', 'closed'].map((st) => (
                            <option key={st} value={st}>
                                {t(`fundraise.${st}`)}
                            </option>
                        ))}
                    </select>
                </label>
            </div>

            {/* Wide screens: the fundraise itself on the left, where it shows and to whom on the right. */}
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <Panel title={t('fundraise.sections.details')}>
                    <div className="grid gap-3 sm:grid-cols-2">
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
                    </div>
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                        <Field label={t('fundraise.target')} error={fe('target_amount')} hint={t('common.optional')}>
                            <input
                                name="target_amount"
                                inputMode="decimal"
                                defaultValue={c.target_amount ?? ''}
                                className={`${textInput(!!fe('target_amount'))} w-full tabular-nums`}
                            />
                        </Field>
                        <Field label={t('fundraise.place')} hint={t('fundraise.placeHint')}>
                            <PickOrType name="location" defaultValue={c.location ?? ''} suggestions={locations} label={t('fundraise.place')} />
                        </Field>
                        <Field label={t('fundraise.startDate')} error={fe('start_date')}>
                            <input type="date" name="start_date" defaultValue={c.start_date ?? ''} className={`${textInput(!!fe('start_date'))} w-full`} />
                        </Field>
                        <Field label={t('fundraise.endDate')} error={fe('end_date')}>
                            <input type="date" name="end_date" defaultValue={c.end_date ?? ''} className={`${textInput(!!fe('end_date'))} w-full`} />
                        </Field>
                    </div>
                    {/* One description; no separate local-language copy. */}
                    <Field label={t('fundraise.description')}>
                        <textarea name="description" rows={4} maxLength={5000} defaultValue={meta.description ?? ''} className={`${textArea()} w-full`} />
                    </Field>
                </Panel>

                <div className="space-y-3">
                    <Panel title={t('fundraise.sections.groups')}>
                        <Field label={t('fundraise.homeGroup')} error={fe('group_id')}>
                            <select
                                name="group_id"
                                defaultValue={c.id ? (c.group_id ?? '') : (defaultGroupId ?? (allowNoGroup ? '' : (groups[0]?.id ?? '')))}
                                className={`${selectInput(!!fe('group_id'))} w-full`}
                            >
                                {allowNoGroup && <option value="">{t('fundraise.noHomeGroup')}</option>}
                                {groups.map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {groupName(g)}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        {otherGroups.length > 0 && (
                            <GroupChecklist
                                name="extra_group_ids"
                                label={t('fundraise.alsoInGroups')}
                                hint={t('fundraise.alsoInGroupsHint')}
                                error={fe('extra_group_ids')}
                                groups={otherGroups.map((g) => ({ value: String(g.id), label: groupName(g) }))}
                                defaultValues={otherGroups.filter((g) => g.linked).map((g) => String(g.id))}
                                lockedValues={otherGroups.filter((g) => g.locked).map((g) => String(g.id))}
                            />
                        )}
                    </Panel>
                    {/* An existing fundraise's public link is switched from its detail page. */}
                    {!c.id && (
                        <Panel title={t('fundraise.sections.sharing')}>
                            <Switch checked={isPublic} onChange={setIsPublic} name="is_public" label={t('fundraise.makePublic')} />
                        </Panel>
                    )}
                    <Panel title={t('fundraise.audience.title')}>
                        <AudienceEditor defaultRows={audience} castes={castes} suggestions={suggestions} error={fe('audience')} bare />
                    </Panel>
                </div>
            </div>

            {state?.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {t(state.error)}
                </p>
            )}
            {/* Pinned to the bottom of the screen: Save is reachable without scrolling back down. */}
            <div className="sticky bottom-0 z-10 -mx-2 -mb-3 flex flex-col-reverse gap-2 border-t border-surface-border bg-white/95 px-2 py-2.5 backdrop-blur sm:-mx-3 sm:flex-row sm:justify-end sm:px-3 lg:-mx-4 lg:px-4">
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

/** A form card with a tinted title bar, like the app's other cards. */
function Panel({ title, children }) {
    return (
        <section className="min-w-0 overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
            <h2 className="border-b border-surface-border bg-card-head px-3.5 py-2 text-sm font-semibold text-primary">{title}</h2>
            <div className="space-y-3 p-3.5">{children}</div>
        </section>
    );
}
