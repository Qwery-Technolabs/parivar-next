'use client';
import { Save } from 'lucide-react';
import Link from 'next/link';
import { startTransition, useActionState, useState } from 'react';
import { saveCampaign } from '@/app/actions/fundraise';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import AvatarPicker from '@/components/groups/avatar-picker';
import GroupChecklist from '@/components/ui/group-checklist';
import PeopleChoice from '@/components/ui/people-choice';
import PickOrType from '@/components/ui/pick-or-type';
import { CAMPAIGN_FORM_ID } from './status-select';
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
 * Status is drawn by the page, in its title row (StatusSelect), and posts with this form.
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
    kind: newKind = 'fundraise',
    mandalPeople = [],
    mandalMemberIds = null,
}) {
    const { t, locale } = useT();
    const [state, action, pending] = useActionState(saveCampaign, null);
    const fe = (name) => (state?.fieldErrors?.[name] ? t(state.fieldErrors[name]) : null);
    const c = campaign ?? {};
    const meta = c.meta ?? {};
    // Only on create — an existing fundraise's link is switched from its detail page.
    const [isPublic, setIsPublic] = useState(defaultPublic);
    // Type comes from the "+ New ▾" menu on the group page (an existing one keeps its own). A Mandal
    // (savings circle) belongs to that one group only: no group choice, other groups, public link or audience.
    const kind = c.kind ?? newKind;
    const mandal = kind === 'mandal';
    const homeGroup = c.id ? (c.group_id ?? '') : (defaultGroupId ?? (allowNoGroup ? '' : (groups[0]?.id ?? '')));
    const [othersToo, setOthersToo] = useState(meta.audience_others === '1');

    // onSubmit + startTransition rather than <form action>: React resets uncontrolled
    // fields after a form action completes, which would wipe the input on a validation error.
    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
    };

    const groupName = (g) => (locale === 'gu' && g.name_local) || g.name;

    return (
        // The Status picker lives in the page title row and joins this form via form="campaign-form".
        <form id={CAMPAIGN_FORM_ID} onSubmit={onSubmit} className="space-y-3">
            {c.id && <input type="hidden" name="id" value={c.id} />}

            {/* Wide screens: the fundraise itself on the left, where it shows and to whom on the right. */}
            <div className="grid items-start gap-3 lg:grid-cols-[minmax(0,1fr)_24rem]">
                <Panel title={t('fundraise.sections.details')}>
                    {/* Two columns: the picture alone on the left, every other field to its right. */}
                    <div className="flex items-start gap-4">
                        <div className="shrink-0">
                            <AvatarPicker name={c.title} initial={meta} />
                        </div>
                        <div className="min-w-0 flex-1 space-y-3">
                            <input type="hidden" name="kind" value={kind} />
                            {mandal && <p className="rounded-md bg-surface-bggray/60 px-3 py-2 text-xs text-ink-gray">{t('mandal.typeHint')}</p>}
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
                            {mandal && (
                                <div className="grid gap-3 sm:grid-cols-2">
                                    <Field label={t('mandal.installment')} hint={t('mandal.installmentHint')} error={fe('installment')} required>
                                        <input
                                            name="installment"
                                            inputMode="decimal"
                                            required
                                            defaultValue={meta.installment ?? ''}
                                            className={`${textInput(!!fe('installment'))} w-full tabular-nums`}
                                        />
                                    </Field>
                                    <Field label={t('mandal.opening')} hint={t('mandal.openingHint')} error={fe('opening_balance')}>
                                        <input
                                            name="opening_balance"
                                            inputMode="decimal"
                                            defaultValue={c.openingBalance ?? ''}
                                            className={`${textInput(!!fe('opening_balance'))} w-full tabular-nums`}
                                        />
                                    </Field>
                                </div>
                            )}
                            {mandal && (
                                <PeopleChoice
                                    people={mandalPeople}
                                    initialIds={mandalMemberIds ?? mandalPeople.map((p) => p.id)}
                                    audience={meta.members_mode ?? (c.id ? 'selected' : 'all')}
                                    label={t('mandal.whoIn')}
                                    modeName="members_mode"
                                    idsName="member_ids"
                                    error={fe('member_ids')}
                                />
                            )}
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
                                    <input
                                        type="date"
                                        name="start_date"
                                        defaultValue={c.start_date ?? ''}
                                        className={`${textInput(!!fe('start_date'))} w-full`}
                                    />
                                </Field>
                                <Field label={t('fundraise.endDate')} error={fe('end_date')}>
                                    <input type="date" name="end_date" defaultValue={c.end_date ?? ''} className={`${textInput(!!fe('end_date'))} w-full`} />
                                </Field>
                            </div>
                            {/* One description; no separate local-language copy. */}
                            <Field label={t('fundraise.description')}>
                                <textarea
                                    name="description"
                                    rows={4}
                                    maxLength={5000}
                                    defaultValue={meta.description ?? ''}
                                    className={`${textArea()} w-full`}
                                />
                            </Field>
                        </div>
                    </div>
                </Panel>

                <div className="space-y-3">
                    <Panel title={t('fundraise.sections.groups')}>
                        <Field label={t('fundraise.homeGroup')} error={fe('group_id')}>
                            <select name="group_id" defaultValue={homeGroup} className={`${selectInput(!!fe('group_id'))} w-full`}>
                                {allowNoGroup && !mandal && <option value="">{t('fundraise.noHomeGroup')}</option>}
                                {/* A Mandal stays in the group it was started in: that one group only. */}
                                {(mandal ? groups.filter((g) => String(g.id) === String(homeGroup)) : groups).map((g) => (
                                    <option key={g.id} value={g.id}>
                                        {groupName(g)}
                                    </option>
                                ))}
                            </select>
                        </Field>
                        {!mandal && otherGroups.length > 0 && (
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
                    {/* A Mandal: its group's people only — no audience rules. */}
                    {!mandal && (
                        <Panel title={t('fundraise.audience.title')}>
                            <AudienceEditor defaultRows={audience} castes={castes} suggestions={suggestions} error={fe('audience')} bare />
                            {/* Off: only the people above see it. On: everyone else too, below their own fundraises. */}
                            <div className="mt-3 border-t border-surface-border pt-3">
                                <Switch checked={othersToo} onChange={setOthersToo} name="audience_others" label={t('fundraise.audience.othersToo')} />
                                <p className="mt-1 text-xs text-ink-gray">{t('fundraise.audience.othersTooHint')}</p>
                            </div>
                        </Panel>
                    )}
                </div>
            </div>

            {state?.error && (
                <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
                    {t(state.error)}
                </p>
            )}
            {/* Pinned to the bottom of the screen: Save is reachable without scrolling back down. */}
            <div className="sticky bottom-0 z-10 -mx-2 -mb-3 flex flex-row gap-2 *:flex-1 sm:*:flex-none border-t border-surface-border bg-white/95 px-2 py-2.5 backdrop-blur sm:-mx-3 sm:justify-end sm:px-3 lg:-mx-4 lg:px-4">
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
