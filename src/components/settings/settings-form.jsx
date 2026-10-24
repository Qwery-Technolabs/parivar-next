'use client';
import { Building2, Info, Languages, Lock, Network, Receipt, RotateCcw, Save, Share2, SlidersHorizontal, UserPlus, Users } from 'lucide-react';
import { startTransition, useActionState, useState } from 'react';
import { toast } from 'sonner';
import { saveModuleSettings } from '@/app/actions/settings';
import { Field, selectInput, textArea, textInput } from '@/components/ui/field';
import SubmitButton from '@/components/ui/submit-button';
import BilingualName from '@/components/ui/bilingual-name';
import FormPart from '@/components/ui/form-part';
import Switch from '@/components/ui/switch';
import { Popover } from '@/components/ui/popover';
import AvatarPicker from '@/components/groups/avatar-picker';
import { renderLogoPngs } from '@/lib/app-icon-canvas';
import MultiSelect from '@/components/ui/multi-select';
import { useT } from '@/lib/i18n/client';

// The icon before each group's title (lib/settings.js `group`).
const GROUP_ICONS = {
    samaj: Building2,
    signup: UserPlus,
    language: Languages,
    members: Users,
    privacy: Lock,
    sharing: Share2,
    expenses: Receipt,
    familyTree: Network,
};

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
 * The ⓘ beside a setting's label: tap → a small panel with the longer explanation (lines split on \n; a line that
 * starts with "Example" / "ઉદાહરણ" is set apart in grey). The short hint under the field stays as it is.
 */
function InfoTip({ label, text }) {
    const lines = text.split('\n');
    return (
        <Popover
            align="left"
            width="w-80"
            role="dialog"
            trigger={({ open, toggle, id }) => (
                <button
                    id={id}
                    type="button"
                    onClick={toggle}
                    aria-expanded={open}
                    aria-label={label}
                    title={label}
                    className={`inline-flex size-5 items-center justify-center rounded-full ${open ? 'text-brand-orange-strong' : 'text-ink-gray hover:text-primary'}`}
                >
                    <Info className="size-3.5" />
                </button>
            )}
        >
            <div className="space-y-2 px-3.5 py-2.5 text-xs leading-relaxed text-ink">
                <p className="text-sm font-semibold text-primary">{label}</p>
                {lines.map((l, i) =>
                    /^(Example|ઉદાહરણ)/.test(l) ? (
                        <p key={i} className="rounded-md bg-surface-bggray/70 px-2.5 py-2 text-ink-gray">
                            {l}
                        </p>
                    ) : (
                        <p key={i}>{l}</p>
                    ),
                )}
            </div>
        </Popover>
    );
}

/**
 * A number setting with what is saved now, the recommended value, and Reset (puts the recommended value back — Save
 * stores it). A div, not Field's <label>: the Reset button inside a label would take the label's clicks.
 */
function NumberSetting({ name, label, hint, info, initial, recommended, min, max }) {
    const { t } = useT();
    const [value, setValue] = useState(String(initial));
    const id = `set-${name}`;
    return (
        <div className="min-w-0">
            <div className="mb-1 flex items-center gap-1">
                <label htmlFor={id} className="text-xs font-medium text-ink-gray">
                    {label}
                </label>
                {info && <InfoTip label={label} text={info} />}
            </div>
            <div className="flex items-center gap-2">
                <input
                    id={id}
                    name={name}
                    type="number"
                    inputMode="numeric"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => setValue(e.target.value)}
                    className={`${textInput()} w-full`}
                />
                <button
                    type="button"
                    onClick={() => setValue(String(recommended))}
                    disabled={Number(value) === recommended}
                    title={t('settings.resetHint')}
                    className="inline-flex h-9 shrink-0 items-center gap-1 rounded-md border border-surface-border px-2.5 text-xs font-medium text-primary hover:bg-accent disabled:opacity-50"
                >
                    <RotateCcw className="size-3.5" /> {t('settings.reset')}
                </button>
            </div>
            <p className="mt-1 text-xs text-ink-gray">
                {t('settings.savedNow', { value: initial })} · {t('settings.recommended', { value: recommended })}
                {min != null && max != null ? ` · ${t('settings.range', { min, max })}` : ''}
            </p>
            {hint && <p className="mt-0.5 text-xs text-ink-gray">{hint}</p>}
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
        ) : f.type === 'multi' ? (
            // A select2-style multi-select (chips in one box, a searchable tick list). "Everyone" / "Anyone" stands
            // alone: picking it clears the rest (components/ui/multi-select.jsx). A div, not Field's <label>: a label
            // would pass a click on its text to the first chip's × button.
            <div key={f.key} className="min-w-0 sm:col-span-2">
                <span className="mb-1 block text-xs font-medium text-ink-gray">{f.label}</span>
                <MultiSelect
                    name={f.key}
                    options={f.options}
                    defaultValue={f.value}
                    exclusive={f.options.find((x) => x.value === 'everyone' || x.value === 'anyone')?.value ?? null}
                    placeholder={t('settings.pickAny')}
                />
                {f.hint && <p className="mt-1 text-xs text-ink-gray">{f.hint}</p>}
            </div>
        ) : f.type === 'list' ? (
            <Field key={f.key} label={f.label} hint={f.hint ?? t('settings.onePerLine')} className="sm:col-span-2">
                <textarea name={f.key} rows={5} defaultValue={f.value.join('\n')} className={`${textArea()} w-full`} />
            </Field>
        ) : f.type === 'number' && f.recommended != null ? (
            <NumberSetting
                key={f.key}
                name={f.key}
                label={f.label}
                hint={f.hint}
                info={f.info}
                initial={f.value}
                recommended={f.recommended}
                min={f.min}
                max={f.max}
            />
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
