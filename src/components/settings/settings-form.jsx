'use client';
import { Building2, Languages, Receipt, Save, Share2, SlidersHorizontal, UserPlus } from 'lucide-react';
import { startTransition, useActionState, useState } from 'react';
import { toast } from 'sonner';
import { saveModuleSettings } from '@/app/actions/settings';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import BilingualName from '@/components/ui/bilingual-name';
import FormPart from '@/components/ui/form-part';
import Switch from '@/components/ui/switch';
import AvatarPicker from '@/components/groups/avatar-picker';
import { renderLogoPngs } from '@/lib/app-icon-canvas';
import { useT } from '@/lib/i18n/client';

// The icon before each group's title (lib/settings.js `group`).
const GROUP_ICONS = { samaj: Building2, signup: UserPlus, language: Languages, sharing: Share2, expenses: Receipt };

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
    const logo = fields.find((f) => f.type === 'logo');
    const { t } = useT();
    const [state, action, pending] = useActionState(async (prev, fd) => {
        const res = await saveModuleSettings(prev, fd);
        if (res?.ok) toast.success(t(res.message));
        return res;
    }, null);

    // One field (or an English → local pair) — null for the logo and for a pair's local twin.
    const renderField = (f) => {
        if (f.type === 'logo') return null; // drawn as the left column
        // A text setting with a `<key>_local` twin renders as one English→local-language pair.
        if (f.key.endsWith('_local') && fields.some((g) => `${g.key}_local` === f.key)) return null;
        const twin = f.type === 'text' && !f.options && fields.find((g) => g.key === `${f.key}_local`);
        if (twin)
            return (
                <BilingualName
                    key={f.key}
                    enLabel={f.label}
                    guLabel={twin.label}
                    enName={f.key}
                    guName={twin.key}
                    defaultEn={f.value}
                    defaultGu={twin.value}
                    maxLength={500}
                    side
                />
            );
        return f.type === 'bool' ? (
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
                <input name={f.key} type={f.type === 'number' ? 'number' : 'text'} defaultValue={f.value} className={`${textInput()} w-full`} />
            </Field>
        );
    };
    // Fields in their groups, in registry order; ungrouped ones together at the end.
    const groups = [];
    for (const f of fields) {
        if (f.type === 'logo') continue;
        const key = f.group ?? 'other';
        let g = groups.find((x) => x.key === key);
        if (!g) groups.push((g = { key, title: f.groupTitle ?? null, fields: [] }));
        g.fields.push(f);
    }

    return (
        <form
            onSubmit={async (e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const fd = new FormData(form);
                // General: draw the logo on a canvas and send it as the favicon / app icon PNGs.
                if (logo) {
                    try {
                        const pngs = await renderLogoPngs({
                            kind: String(fd.get('avatar_kind') ?? ''),
                            value: String(fd.get('avatar_value') ?? ''),
                            color: String(fd.get('avatar_color') ?? ''),
                            iconSvg: form.querySelector('[data-avatar-preview] svg'),
                        });
                        for (const [size, url] of Object.entries(pngs)) fd.set(`logo_png_${size}`, url);
                    } catch {
                        // Drawing failed (old browser): settings still save; the icon stays as it was.
                    }
                }
                startTransition(() => action(fd));
            }}
            className="rounded-lg border border-surface-border bg-white shadow-sm"
        >
            <input type="hidden" name="module" value={module} />
            <h2 className="rounded-t-lg border-b border-surface-border bg-card-head px-3.5 py-2.5 text-sm font-semibold text-primary">{title}</h2>
            {/* With a logo field (General): the logo alone on the left, every other field to its right. */}
            <div className={logo ? 'flex items-start gap-4 p-3.5' : 'p-3.5'}>
                {logo && (
                    <div className="shrink-0">
                        <AvatarPicker name={fields.find((g) => g.key === logo.with)?.value || ''} initial={logo.value} />
                    </div>
                )}
                <div className="min-w-0 flex-1 space-y-3">
                    {groups.map((g) => (
                        <FormPart key={g.key} title={g.title} icon={GROUP_ICONS[g.key] ?? SlidersHorizontal}>
                            <div className="grid gap-3 sm:grid-cols-2">{g.fields.map(renderField)}</div>
                        </FormPart>
                    ))}
                </div>
            </div>
            {state?.error && <p className="px-4 pb-3 text-xs font-medium text-destructive">{t(state.error)}</p>}
            <div className="flex justify-end border-t border-surface-border px-3.5 py-2.5">
                <SubmitButton icon={Save} pending={pending} pendingText={t('common.saving')}>
                    {t('common.save')}
                </SubmitButton>
            </div>
        </form>
    );
}
