'use client';
import { BellRing, Send, Smartphone, Users, X } from 'lucide-react';
import { useActionState, useState } from 'react';
import { toast } from 'sonner';
import { sendPushMessage } from '@/app/actions/push';
import { Card } from '@/components/shell/page-header';
import { Field, textArea, textInput } from '@/components/ui/field';
import GroupChecklist from '@/components/ui/group-checklist';
import MemberPicker from '@/components/ui/member-picker';
import SubmitButton from '@/components/ui/submit-button';
import { useT } from '@/lib/i18n/client';

const TITLE_MAX = 80;
const BODY_MAX = 300;

/**
 * Settings → Samaj → Push notification (administrators): Title, Description, Target → Send. Push only (no bell copy),
 * to the devices of active members who turned notifications on. `stats`: { people, devices } with notifications on.
 * @param {{ stats: { people: number, devices: number }, groups: Array<{ value: string, label: string }> }} props
 */
export default function PushComposer({ stats, groups }) {
    const { t } = useT();
    const [target, setTarget] = useState('all');
    const [members, setMembers] = useState([]);
    const [pickerKey, setPickerKey] = useState(0);
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
            setMembers([]);
            setFormKey((k) => k + 1);
        } else if (res?.error) toast.error(t(res.error));
        return res;
    }, null);
    const err = (name) => (state?.fieldErrors?.[name] ? t(state.fieldErrors[name]) : null);

    return (
        <div className="space-y-4">
            {/* Who can be reached at all: people (and their devices) with notifications turned on. */}
            <div className="grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-surface-border bg-white p-3">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-gray">
                        <Users className="size-3.5" /> {t('push.admin.people')}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-primary">{stats.people}</p>
                </div>
                <div className="rounded-lg border border-surface-border bg-white p-3">
                    <p className="flex items-center gap-1.5 text-[11px] uppercase tracking-wide text-ink-gray">
                        <Smartphone className="size-3.5" /> {t('push.admin.devices')}
                    </p>
                    <p className="mt-1 text-xl font-semibold tabular-nums text-primary">{stats.devices}</p>
                </div>
            </div>
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
                    <Field label={t('push.admin.link')} hint={t('push.admin.linkHint')} error={err('link')}>
                        <input
                            name="link"
                            type="text"
                            inputMode="url"
                            maxLength={500}
                            placeholder="/fundraise/12"
                            className={`${textInput(!!err('link'))} w-full`}
                        />
                    </Field>
                    {/* A div, not Field's <label> (it would pass a click on its text to the first button). */}
                    <div>
                        <span className="mb-1 block text-xs font-medium text-ink-gray">
                            {t('push.admin.target')}
                            <span className="ml-0.5 text-destructive">*</span>
                        </span>
                        <input type="hidden" name="target" value={target} />
                        <div className="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
                            {['all', 'groups', 'members'].map((v) => (
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
                        {err('target') && <p className="mt-1 text-xs font-medium text-destructive">{err('target')}</p>}
                    </div>
                    {/* Hidden, not unmounted: the ticks survive switching the target back and forth. */}
                    <div hidden={target !== 'groups'}>
                        <GroupChecklist key={formKey} groups={groups} name="group_ids" />
                    </div>
                    <div hidden={target !== 'members'} className="space-y-2">
                        <MemberPicker
                            key={pickerKey}
                            exclude={members.map((m) => m.value)}
                            onPick={(opt) => {
                                if (opt?.value) setMembers((list) => (list.some((m) => m.value === opt.value) ? list : [...list, opt]));
                                setPickerKey((k) => k + 1);
                            }}
                        />
                        {members.length > 0 && (
                            <ul className="flex flex-wrap gap-1.5">
                                {members.map((m) => (
                                    <li
                                        key={m.value}
                                        className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pr-1 pl-2.5 text-xs font-medium text-primary"
                                    >
                                        <input type="hidden" name="member_ids" value={m.value} />
                                        {m.label}
                                        <button
                                            type="button"
                                            onClick={() => setMembers((list) => list.filter((x) => x.value !== m.value))}
                                            aria-label={t('common.remove')}
                                            className="rounded-full p-0.5 text-ink-gray hover:bg-white hover:text-destructive"
                                        >
                                            <X className="size-3" />
                                        </button>
                                    </li>
                                ))}
                            </ul>
                        )}
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
