'use client';
import { CalendarPlus, Pencil, Search } from 'lucide-react';
import { useState } from 'react';
import { saveMeeting } from '@/app/actions/meetings';
import BilingualName from '@/components/ui/bilingual-name';
import { Field, textArea, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useT } from '@/lib/i18n/client';

const OFFSETS = [1440, 60, 15, 0];

/** Who needs to come: everyone in the group/fundraise, or a hand-picked list (with search). */
function Attendees({ people, initialIds, error }) {
    const { t, locale } = useT();
    const all = people.map((p) => p.id);
    const [mode, setMode] = useState(initialIds && initialIds.length < all.length ? 'selected' : 'all');
    const [picked, setPicked] = useState(new Set(initialIds ?? all));
    const [q, setQ] = useState('');
    const name = (p) => (locale !== 'en' && p.full_name_local) || p.full_name;
    const shown = people.filter((p) => !q || name(p).toLowerCase().includes(q.toLowerCase()) || p.full_name.toLowerCase().includes(q.toLowerCase()));
    const toggle = (id) =>
        setPicked((s) => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });

    return (
        <div>
            <p className="mb-1 text-xs font-medium text-ink-gray">{t('meetings.whoComes')}</p>
            <input type="hidden" name="invite" value={mode} />
            <div className="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
                {['all', 'selected'].map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`h-8 shrink-0 rounded px-3 text-xs font-medium ${mode === m ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-brand-navy'}`}
                    >
                        {m === 'all' ? t('meetings.everyone', { count: people.length }) : t('meetings.choose')}
                    </button>
                ))}
            </div>
            {mode === 'selected' && (
                <div className="mt-2 rounded-md border border-surface-border">
                    <div className="relative border-b border-surface-border">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-gray" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={t('common.search')}
                            className="h-8 w-full rounded-t-md bg-white pl-8 pr-3 text-sm outline-none"
                        />
                    </div>
                    <ul className="max-h-48 overflow-y-auto py-1">
                        {shown.map((p) => (
                            <li key={p.id}>
                                <label className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm text-primary hover:bg-accent">
                                    <input type="checkbox" checked={picked.has(p.id)} onChange={() => toggle(p.id)} className="size-4 accent-[var(--color-brand-orange-strong)]" />
                                    {name(p)}
                                </label>
                            </li>
                        ))}
                    </ul>
                    <p className="border-t border-surface-border px-3 py-1 text-xs text-ink-gray">{t('meetings.chosenCount', { count: picked.size })}</p>
                    {[...picked].map((id) => (
                        <input key={id} type="hidden" name="attendee_ids" value={id} />
                    ))}
                </div>
            )}
            {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
        </div>
    );
}

/**
 * Schedule (no `meeting`) or edit a meeting of a group or fundraise.
 * @param {{ scope: 'group'|'fundraise', scopeId: number, people: any[], meeting?: any, defaultTitle?: string, defaultPlace?: string, today: string, compact?: boolean }} props
 */
export default function MeetingDialog({ scope, scopeId, people, meeting = null, defaultTitle = '', defaultPlace = '', today, compact = false }) {
    const { t } = useT();
    const isEdit = Boolean(meeting);
    const reminders = new Set(meeting ? meeting.reminders : [1440, 60]);

    return (
        <FormDialog
            title={isEdit ? t('meetings.edit') : t('meetings.schedule')}
            action={saveMeeting}
            hidden={{ scope, scope_id: scopeId, meeting_id: meeting?.id ?? '' }}
            submitIcon={isEdit ? Pencil : CalendarPlus}
            width="sm:max-w-xl"
            // Phones: icon-only buttons (aria-label + title carry the name); icon + text from sm up.
            trigger={({ open }) =>
                isEdit ? (
                    <button
                        type="button"
                        onClick={open}
                        aria-label={t('common.edit')}
                        title={t('common.edit')}
                        className="btn-secondary inline-flex size-8 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
                    >
                        <Pencil className="size-3.5" /> <span className="hidden sm:inline">{t('common.edit')}</span>
                    </button>
                ) : (
                    <button
                        type="button"
                        onClick={open}
                        aria-label={t('meetings.schedule')}
                        title={t('meetings.schedule')}
                        className={`btn-secondary inline-flex shrink-0 items-center justify-center gap-1.5 rounded-md font-medium ${
                            compact ? 'size-8 text-xs sm:w-auto sm:px-3' : 'size-9 text-sm sm:w-auto sm:px-4'
                        }`}
                    >
                        <CalendarPlus className="size-4" /> <span className="hidden sm:inline">{t('meetings.schedule')}</span>
                    </button>
                )
            }
        >
            {({ fieldError }) => (
                <>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <BilingualName
                            enLabel={t('meetings.title')}
                            guLabel={t('meetings.titleLocal')}
                            enName="title"
                            guName="title_local"
                            defaultEn={meeting?.title ?? defaultTitle}
                            defaultGu={meeting?.title_local ?? ''}
                            maxLength={200}
                        />
                        <Field label={t('meetings.date')} error={fieldError('start_date')} required>
                            <input
                                type="date"
                                name="start_date"
                                min={isEdit ? undefined : today}
                                defaultValue={meeting?.start_date ?? ''}
                                required
                                className={`${textInput(!!fieldError('start_date'))} w-full`}
                            />
                        </Field>
                        <Field label={t('meetings.time')} error={fieldError('start_time')}>
                            <input type="time" name="start_time" defaultValue={meeting?.start_time?.slice(0, 5) ?? ''} className={`${textInput(!!fieldError('start_time'))} w-full`} />
                        </Field>
                        <Field label={t('meetings.place')} className="sm:col-span-2">
                            <input name="location" maxLength={200} defaultValue={meeting?.location ?? defaultPlace} className={`${textInput()} w-full`} />
                        </Field>
                        <Field label={t('meetings.agenda')} className="sm:col-span-2">
                            <textarea name="agenda" rows={3} defaultValue={meeting?.agenda ?? ''} className={`${textArea()} w-full`} />
                        </Field>
                    </div>
                    <Attendees people={people} initialIds={meeting?.attendees?.map((a) => a.user_id)} error={fieldError('attendee_ids')} />
                    <div>
                        <p className="mb-1 text-xs font-medium text-ink-gray">{t('meetings.remind')}</p>
                        <div className="flex flex-wrap gap-2">
                            {OFFSETS.map((m) => (
                                <label
                                    key={m}
                                    className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-surface-border px-2.5 py-1 text-xs font-medium text-primary has-[:checked]:border-transparent has-[:checked]:bg-orange-50"
                                >
                                    <input type="checkbox" name="reminders" value={m} defaultChecked={reminders.has(m)} className="size-3.5 accent-[var(--color-brand-orange-strong)]" />
                                    {t(`meetings.offsets.${m}`)}
                                </label>
                            ))}
                        </div>
                        <p className="mt-1 text-xs text-ink-gray">{t('meetings.remindHint')}</p>
                    </div>
                </>
            )}
        </FormDialog>
    );
}
