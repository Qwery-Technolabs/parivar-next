'use client';
import { Save } from 'lucide-react';
import { startTransition, useActionState, useState } from 'react';
import { toast } from 'sonner';
import { saveModuleSettings } from '@/app/actions/settings';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

function BoolSetting({ name, label, hint, initial }) {
    const [on, setOn] = useState(initial);
    return (
        <div>
            <Switch checked={on} onChange={setOn} name={name} label={label} />
            {hint && <p className="mt-1 text-xs text-ink-gray">{hint}</p>}
        </div>
    );
}

/**
 * One card per module. `fields` comes from the server registry (SETTINGS), so this form
 * never lists a key the server would not accept.
 * @param {{ module: string, title: string, fields: Array<{ key: string, type: string, value: any, label: string, hint?: string, options?: Array<{value: string, label: string}> }> }} props
 */
export default function SettingsForm({ module, title, fields }) {
    const { t } = useT();
    const [state, action, pending] = useActionState(async (prev, fd) => {
        const res = await saveModuleSettings(prev, fd);
        if (res?.ok) toast.success(t(res.message));
        return res;
    }, null);

    return (
        <form
            onSubmit={(e) => {
                e.preventDefault();
                const fd = new FormData(e.currentTarget);
                startTransition(() => action(fd));
            }}
            className="rounded-lg border border-surface-border bg-white shadow-sm"
        >
            <input type="hidden" name="module" value={module} />
            <h2 className="border-b border-surface-border px-4 py-3 text-sm font-semibold text-primary">{title}</h2>
            <div className="grid gap-4 p-4 sm:grid-cols-2">
                {fields.map((f) =>
                    f.type === 'bool' ? (
                        <div key={f.key} className="sm:col-span-2">
                            <BoolSetting name={f.key} label={f.label} hint={f.hint} initial={f.value} />
                        </div>
                    ) : f.type === 'list' ? (
                        <Field key={f.key} label={f.label} hint={f.hint ?? t('settings.onePerLine')} className="sm:col-span-2">
                            <textarea name={f.key} rows={5} defaultValue={f.value.join('\n')} className={`${textArea()} w-full`} />
                        </Field>
                    ) : f.options ? (
                        <Field key={f.key} label={f.label} hint={f.hint}>
                            <select name={f.key} defaultValue={f.value} className={`${selectInput()} w-full`}>
                                {f.options.map((o) => (
                                    <option key={o.value} value={o.value}>
                                        {o.label}
                                    </option>
                                ))}
                            </select>
                        </Field>
                    ) : (
                        <Field key={f.key} label={f.label} hint={f.hint}>
                            <input
                                name={f.key}
                                type={f.type === 'number' ? 'number' : 'text'}
                                defaultValue={f.value}
                                className={`${textInput()} w-full`}
                            />
                        </Field>
                    ),
                )}
            </div>
            {state?.error && <p className="px-4 pb-3 text-xs font-medium text-destructive">{t(state.error)}</p>}
            <div className="flex justify-end border-t border-surface-border px-4 py-3">
                <SubmitButton icon={Save} pending={pending} pendingText={t('common.saving')}>
                    {t('common.save')}
                </SubmitButton>
            </div>
        </form>
    );
}
