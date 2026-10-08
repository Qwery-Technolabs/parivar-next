'use client';
import { CalendarPlus, Plus, Save } from 'lucide-react';
import { useState } from 'react';
import { saveMandalSchedule } from '@/app/actions/mandal';
import { Field, selectInput, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { useT } from '@/lib/i18n/client';

/**
 * New / edit one Mandal schedule ("21 Oct 2026 - Mandal"): date, place, whether money is collected
 * that day and how much per member (set HERE, not on the attendance sheet), and who keeps it.
 * `members`: [{ id, full_name, full_name_local }].
 */
export default function ScheduleDialog({ campaignId, schedule = null, members, defaultInstallment, today, trigger }) {
    const { t, locale } = useT();
    const [collect, setCollect] = useState(schedule ? Boolean(schedule.collect) : true);
    const name = (m) => (locale !== 'en' && m.full_name_local) || m.full_name;
    return (
        <FormDialog
            title={schedule ? t('mandal.editSchedule') : t('mandal.newSchedule')}
            action={saveMandalSchedule}
            hidden={{ campaign_id: campaignId, event_id: schedule?.id ?? '' }}
            submitIcon={schedule ? Save : CalendarPlus}
            width="sm:max-w-md"
            trigger={
                trigger ??
                (({ open }) => (
                    <button
                        type="button"
                        onClick={open}
                        aria-label={t('mandal.newSchedule')}
                        title={t('mandal.newSchedule')}
                        className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
                    >
                        <Plus className="size-3.5" /> <span className="hidden sm:inline">{t('mandal.newSchedule')}</span>
                    </button>
                ))
            }
        >
            {({ fieldError }) => (
                <div className="grid gap-3 sm:grid-cols-2">
                    <input type="hidden" name="collect" value={collect ? '1' : '0'} />
                    <div className="sm:col-span-2">
                        <p className="mb-1 text-xs font-medium text-ink-gray">{t('mandal.collect')}</p>
                        <div role="radiogroup" className="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
                            {[true, false].map((v) => (
                                <button
                                    key={String(v)}
                                    type="button"
                                    role="radio"
                                    aria-checked={collect === v}
                                    onClick={() => setCollect(v)}
                                    className={`h-8 rounded px-3 text-xs font-medium ${collect === v ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-primary'}`}
                                >
                                    {t(v ? 'common.yes' : 'common.no')}
                                </button>
                            ))}
                        </div>
                    </div>
                    <Field label={t('common.date')} error={fieldError('start_date')} required>
                        <input
                            type="date"
                            name="start_date"
                            required
                            defaultValue={schedule?.start_date ?? today}
                            className={`${textInput(!!fieldError('start_date'))} w-full`}
                        />
                    </Field>
                    {collect ? (
                        <Field label={t('mandal.amountThisTime')} error={fieldError('installment')} required>
                            <input
                                name="installment"
                                type="number"
                                inputMode="decimal"
                                min="0"
                                step="0.01"
                                required
                                defaultValue={schedule?.installment || defaultInstallment || ''}
                                className={`${textInput(!!fieldError('installment'))} w-full tabular-nums`}
                            />
                        </Field>
                    ) : (
                        <div className="hidden sm:block" />
                    )}
                    <Field label={t('fundraise.place')}>
                        <input name="location" maxLength={200} defaultValue={schedule?.location ?? ''} className={`${textInput()} w-full`} />
                    </Field>
                    <Field label={t('mandal.moneyWithLabel')} hint={t('mandal.moneyWithHint')} error={fieldError('held_by')}>
                        <select name="held_by" defaultValue={schedule?.holder?.id ?? ''} className={`${selectInput(!!fieldError('held_by'))} w-full`}>
                            <option value="">{t('mandal.notSet')}</option>
                            {members.map((m) => (
                                <option key={m.id} value={m.id}>
                                    {name(m)}
                                </option>
                            ))}
                        </select>
                    </Field>
                </div>
            )}
        </FormDialog>
    );
}
