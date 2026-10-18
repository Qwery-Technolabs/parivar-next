'use client';
import { BellRing, Send } from 'lucide-react';
import { useActionState, useState } from 'react';
import { toast } from 'sonner';
import { sendPushMessage } from '@/app/actions/push';
import { Card } from '@/components/shell/page-header';
import { Field, textArea, textInput } from '@/components/ui/field';
import GroupChecklist from '@/components/ui/group-checklist';
import MultiSelect from '@/components/ui/multi-select';
import SubmitButton from '@/components/ui/submit-button';
import SwitchBox from '@/components/ui/switch-box';
import PushReach from './push-reach-dialog';
import { useT } from '@/lib/i18n/client';

const TITLE_MAX = 80;
const BODY_MAX = 300;

/**
 * Settings → Samaj → Push notification (administrators): Title, Description, Target → Send. Push only (no bell copy),
 * to the devices of active members who turned notifications on. `stats`: { people, devices } with notifications on.
 * `people`: [{ value, label, sub }] — active members with notifications on (the "Selected members" choices).
 * @param {{ stats: { people: number, devices: number }, groups: Array<{ value: string, label: string }>, people?: Array<{ value: string, label: string, sub?: string }> }} props
 */
export default function PushComposer({ stats, groups, people = [], devices = [] }) {
    const { t } = useT();
    const [target, setTarget] = useState('all');
    const [withLink, setWithLink] = useState(false);
    const [title, setTitle] = useState('');
    const [body, setBody] = useState('');
    const [formKey, setFormKey] = useState(0);
    const [state, action] = useActionState(async (prev, fd) => {
        if (!window.confirm(t('push.admin.confirm'))) return prev;
        const res = await sendPushMessage(prev, fd);
        if (res?.ok) {
            toast.success(t(res.message, res.vars));
            setTitle('');
            setBody('');
            setWithLink(false);
            setTarget('all');
            setFormKey((k) => k + 1);
        } else if (res?.error) toast.error(t(res.error));
        return res;
    }, null);
    const err = (name) => (state?.fieldErrors?.[name] ? t(state.fieldErrors[name]) : null);

    return (
        <div className="space-y-4">
            {/* Who can be reached: people / devices with notifications on — each box opens its searchable list. */}
            <PushReach stats={stats} devices={devices} />
            <Card title={t('push.admin.compose')}>
                <p className="mb-3 text-xs text-ink-gray">{t('push.admin.hint')}</p>
                <form key={formKey} action={action} className="space-y-3">
                    <Field label={t('push.admin.title')} error={err('title')} required hint={`${title.length}/${TITLE_MAX}`}>
                        <input
                            name="title"
                            value={title}
                            onChange={(e) => setTitle(e.target.value)}
                            maxLength={TITLE_MAX}
                            className={`${textInput(!!err('title'))} w-full`}
                        />
                    </Field>
                    <Field label={t('push.admin.body')} error={err('body')} required hint={`${body.length}/${BODY_MAX}`}>
                        <textarea
                            name="body"
                            rows={3}
                            value={body}
                            onChange={(e) => setBody(e.target.value)}
                            maxLength={BODY_MAX}
                            className={`${textArea(!!err('body'))} w-full`}
                        />
                    </Field>
                    {/* Two optional parts side by side, each behind its switch: a page to open on tap, and a narrower
                        audience (off = everyone with notifications on). */}
                    <div className="grid gap-3 sm:grid-cols-2">
                        <SwitchBox label={t('push.admin.linkSwitch')} hint={t('push.admin.linkOff')} on={withLink} onChange={setWithLink}>
                            <input
                                name="link"
                                type="text"
                                inputMode="url"
                                maxLength={500}
                                placeholder="/fundraise/12"
                                aria-label={t('push.admin.link')}
                                className={`${textInput(!!err('link'))} w-full`}
                            />
                            {err('link') ? (
                                <p className="text-xs font-medium text-destructive">{err('link')}</p>
                            ) : (
                                <p className="text-xs text-ink-gray">{t('push.admin.linkHint')}</p>
                            )}
                        </SwitchBox>
                        <SwitchBox
                            label={t('push.admin.audienceSwitch')}
                            hint={t('push.admin.audienceOff')}
                            on={target !== 'all'}
                            onChange={(v) => setTarget(v ? 'groups' : 'all')}
                        >
                            <div className="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
                                {['groups', 'members'].map((v) => (
                                    <button
                                        key={v}
                                        type="button"
                                        onClick={() => setTarget(v)}
                                        className={`h-8 shrink-0 rounded px-3 text-xs font-medium ${
                                            target === v ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-brand-navy'
                                        }`}
                                    >
                                        {t(`push.admin.targets.${v}`)}
                                    </button>
                                ))}
                            </div>
                            {err('target') && <p className="text-xs font-medium text-destructive">{err('target')}</p>}
                        </SwitchBox>
                    </div>
                    <input type="hidden" name="target" value={target} />
                    {/* Hidden, not unmounted: the ticks survive switching the target back and forth. */}
                    <div hidden={target !== 'groups'}>
                        <GroupChecklist key={formKey} groups={groups} name="group_ids" />
                    </div>
                    {/* Only people who have notifications on (nobody else could get it): searchable, Select all / Deselect all.
                        Hidden, not unmounted, so the choice survives switching the target. */}
                    <div hidden={target !== 'members'}>
                        <MultiSelect
                            key={formKey}
                            name="member_ids"
                            options={people}
                            bulk
                            summary={(n) => t('push.admin.membersSelected', { count: n })}
                            placeholder={people.length ? t('push.admin.pickMembersHint') : t('push.admin.nobodyOn')}
                        />
                    </div>
                    {/* What arrives on the phone: the Samaj logo, the title, the description. */}
                    {(title || body) && (
                        <div className="flex items-start gap-2.5 rounded-lg bg-surface-bggray/60 p-2.5 ring-1 ring-inset ring-surface-border">
                            <span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-brand-navy text-white">
                                <BellRing className="size-4" />
                            </span>
                            <div className="min-w-0">
                                <p className="truncate text-sm font-semibold text-primary">{title || t('push.admin.title')}</p>
                                <p className="line-clamp-3 whitespace-pre-line text-xs text-ink">{body}</p>
                            </div>
                        </div>
                    )}
                    <div className="flex justify-end">
                        <SubmitButton icon={Send} pendingText={t('push.admin.sending')}>
                            {t('push.admin.send')}
                        </SubmitButton>
                    </div>
                </form>
            </Card>
        </div>
    );
}
