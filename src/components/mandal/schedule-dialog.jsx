'use client';
import { CalendarPlus, HandCoins, Plus, Save } from 'lucide-react';
import { useState } from 'react';
import { saveMandalSchedule } from '@/app/actions/mandal';
import Combobox from '@/components/ui/combobox';
import { Field, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import FormPart from '@/components/ui/form-part';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

/**
 * "Money kept by": type to search (English or Gujarati name) among the Mandal's members — plus the
 * default keeper if they are not one. Clearable (= not set). Its own component so its state remounts
 * with the dialog's form.
 */
function KeeperField({ members, initial, fieldError }) {
    const { t, locale } = useT();
    const name = (m) => (locale !== 'en' && m.full_name_local) || m.full_name;
    const people = initial && !members.some((m) => m.id === initial.id) ? [initial, ...members] : members;
    const options = people.map((m) => ({
        value: String(m.id),
        label: name(m),
        hint: m.full_name !== name(m) ? m.full_name : undefined,
    }));
    const [keeper, setKeeper] = useState(() => options.find((o) => o.value === String(initial?.id ?? '')) ?? null);
    const search = async (q) => {
        const needle = q.trim().toLowerCase();
        if (!needle) return options;
        return options.filter((o) => o.label.toLowerCase().includes(needle) || (o.hint ?? '').toLowerCase().includes(needle));
    };
    return (
        <Field label={t('mandal.moneyWithLabel')} hint={t('mandal.moneyWithHint')} error={fieldError('held_by')}>
            <Combobox
                name="held_by"
                value={keeper?.value ?? ''}
                valueLabel={keeper?.label ?? ''}
                onSelect={(opt) => setKeeper(opt)}
                fetchOptions={search}
                placeholder={t('mandal.notSet')}
                hasError={!!fieldError('held_by')}
                emptyText={t('mandal.searchNone')}
            />
        </Field>
    );
}

/**
 * New / edit one Mandal schedule ("21 Oct 2026 - Mandal"): date, place, whether money is collected
 * that day and how much per member (set HERE, not on the attendance sheet), and who keeps it — a new
 * schedule starts with `defaultKeeper` (the last schedule's keeper, else the treasurer).
 * `members`: [{ id, full_name, full_name_local }].
 */
export default function ScheduleDialog({ campaignId, schedule = null, members, defaultInstallment, defaultKeeper = null, today, trigger }) {
    const { t } = useT();
    const [collect, setCollect] = useState(schedule ? Boolean(schedule.collect) : true);
    // Its money handed to the treasurer — set here for the whole schedule (not on each payment).
    const [handed, setHanded] = useState(Boolean(schedule?.handedOver));
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
                <div className="space-y-3">
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
                    </div>
                    {/* Holding — like the contribution form's: who keeps the money, and has it reached the treasurer (one row). */}
                    <FormPart title={t('fundraise.parts.holding')} icon={HandCoins}>
                        <div className="grid items-start gap-3 sm:grid-cols-2">
                            <KeeperField members={members} initial={schedule ? schedule.holder : defaultKeeper} fieldError={fieldError} />
                            <div className="sm:pt-7">
                                <Switch checked={handed} onChange={setHanded} name="handed_over" label={t('fundraise.handedSwitch')} />
                                <p className="mt-1 text-xs text-ink-gray">{t('mandal.handedScheduleHint')}</p>
                            </div>
                        </div>
                    </FormPart>
                </div>
            )}
        </FormDialog>
    );
}
