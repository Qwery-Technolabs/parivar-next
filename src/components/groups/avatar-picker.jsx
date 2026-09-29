'use client';
import { Check, Pencil, Pipette, Shapes, Smile, Type } from 'lucide-react';
import { useState } from 'react';
import GroupAvatar, { AVATAR_ICON_MAP } from '@/components/groups/group-avatar';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { textInput } from '@/components/ui/field';
import { AVATAR_COLORS, AVATAR_EMOJIS, AVATAR_ICONS, avatarInk, cleanAvatarColor, cleanAvatarText, randomAvatar } from '@/lib/group-avatar';
import { useT } from '@/lib/i18n/client';

/**
 * Group picture in the group form: the avatar itself is the button (left of the name).
 * Clicking opens its own popup — Icon / Emoji / Text (≤2 characters) and a preset or custom
 * background colour. Done applies, Cancel discards. A new group starts on a random icon.
 * Submits avatar_kind, avatar_value, avatar_color with the surrounding form.
 * @param {{ name?: string, initial?: { avatar_kind?: string, avatar_value?: string, avatar_color?: string } }} props
 */
export default function AvatarPicker({ name = '', initial = {} }) {
    const { t } = useT();
    const [avatar, setAvatar] = useState(() =>
        initial.avatar_kind ? { avatar_kind: initial.avatar_kind, avatar_value: initial.avatar_value ?? '', avatar_color: initial.avatar_color ?? '' } : randomAvatar(),
    );
    const [open, setOpen] = useState(false);

    return (
        <>
            <input type="hidden" name="avatar_kind" value={avatar.avatar_kind} />
            <input type="hidden" name="avatar_value" value={avatar.avatar_value} />
            <input type="hidden" name="avatar_color" value={avatar.avatar_color} />
            <button
                type="button"
                data-avatar-preview
                onClick={() => setOpen(true)}
                aria-label={t('groups.avatar.change')}
                title={t('groups.avatar.change')}
                className="group relative mt-5 shrink-0 rounded-full focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:outline-none"
            >
                <GroupAvatar name={name || '?'} kind={avatar.avatar_kind} value={avatar.avatar_value} color={avatar.avatar_color} className="size-14! text-xl" />
                <span className="absolute -right-0.5 -bottom-0.5 flex size-6 items-center justify-center rounded-full border-2 border-white btn-secondary shadow-sm group-hover:scale-105">
                    <Pencil className="size-3" />
                </span>
            </button>
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="max-h-[92vh] overflow-y-auto bg-white sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-base font-semibold text-primary">{t('groups.avatar.title')}</DialogTitle>
                        <DialogDescription className="text-xs text-ink-gray">{t('groups.avatar.description')}</DialogDescription>
                    </DialogHeader>
                    {/* Remounts per open, so an unfinished edit never carries over. */}
                    {open && (
                        <PickerBody
                            name={name}
                            initial={avatar}
                            onCancel={() => setOpen(false)}
                            onDone={(next) => {
                                setAvatar(next);
                                setOpen(false);
                            }}
                        />
                    )}
                </DialogContent>
            </Dialog>
        </>
    );
}

function PickerBody({ name, initial, onCancel, onDone }) {
    const { t } = useT();
    const [kind, setKind] = useState(initial.avatar_kind || 'icon');
    // Each kind remembers its own choice, so flipping tabs doesn't lose it.
    const [values, setValues] = useState({ icon: '', emoji: '', text: '', [initial.avatar_kind || 'icon']: initial.avatar_value });
    const [color, setColor] = useState(initial.avatar_color || AVATAR_COLORS[0]);
    const value = values[kind] ?? '';
    const pick = (v) => setValues((s) => ({ ...s, [kind]: v }));
    const custom = !AVATAR_COLORS.includes(color);

    const kinds = [
        { key: 'icon', label: t('groups.avatar.icon'), Icon: Shapes },
        { key: 'emoji', label: t('groups.avatar.emoji'), Icon: Smile },
        { key: 'text', label: t('groups.avatar.text'), Icon: Type },
    ];
    const cell = (active) =>
        `flex aspect-square items-center justify-center rounded-md border text-lg transition-colors ${
            active ? 'border-primary bg-primary/10 ring-2 ring-primary/30' : 'border-surface-border hover:bg-accent'
        }`;
    const grid = 'grid max-h-56 grid-cols-[repeat(auto-fill,minmax(2.5rem,1fr))] gap-1.5 overflow-y-auto p-0.5';

    return (
        <div className="space-y-3">
            <div className="flex items-center gap-3">
                <GroupAvatar name={name || '?'} kind={value ? kind : ''} value={value} color={color} className="size-14! text-xl" />
                <div role="tablist" className="inline-flex rounded-md border border-surface-border p-0.5">
                    {kinds.map(({ key, label, Icon }) => (
                        <button
                            key={key}
                            type="button"
                            role="tab"
                            aria-selected={kind === key}
                            onClick={() => setKind(key)}
                            className={`inline-flex h-7 items-center gap-1 rounded px-2 text-xs font-medium ${kind === key ? 'seg-active' : 'text-ink-gray hover:text-primary'}`}
                        >
                            <Icon className="size-3.5" /> {label}
                        </button>
                    ))}
                </div>
            </div>

            {kind === 'icon' && (
                <div className={grid}>
                    {AVATAR_ICONS.map((n) => {
                        const I = AVATAR_ICON_MAP[n];
                        return (
                            <button key={n} type="button" title={n} aria-label={n} aria-pressed={value === n} onClick={() => pick(n)} className={cell(value === n)}>
                                <I className="size-5 text-primary" />
                            </button>
                        );
                    })}
                </div>
            )}
            {kind === 'emoji' && (
                <div className={grid}>
                    {AVATAR_EMOJIS.map((e) => (
                        <button key={e} type="button" aria-label={e} aria-pressed={value === e} onClick={() => pick(e)} className={cell(value === e)}>
                            {e}
                        </button>
                    ))}
                </div>
            )}
            {kind === 'text' && (
                <div>
                    <input
                        value={value}
                        onChange={(e) => pick(cleanAvatarText(e.target.value))}
                        placeholder={t('groups.avatar.textPlaceholder')}
                        aria-label={t('groups.avatar.text')}
                        className={`${textInput()} w-24 text-center font-semibold`}
                    />
                    <p className="mt-1 text-xs text-ink-gray">{t('groups.avatar.textHint')}</p>
                </div>
            )}

            <div className="border-t border-surface-border pt-3">
                <p className="mb-1.5 text-xs font-medium text-ink-gray">{t('groups.avatar.color')}</p>
                <div className="flex flex-wrap items-center gap-1.5">
                    {AVATAR_COLORS.map((c) => (
                        <button
                            key={c}
                            type="button"
                            aria-label={c}
                            aria-pressed={color === c}
                            onClick={() => setColor(c)}
                            style={{ backgroundColor: c }}
                            className={`flex size-7 items-center justify-center rounded-full text-white ${color === c ? 'ring-2 ring-primary ring-offset-2' : ''}`}
                        >
                            {color === c && <Check className="size-4" />}
                        </button>
                    ))}
                    {/* Custom colour: the native picker, shown as one more swatch. */}
                    <label
                        title={t('groups.avatar.customColor')}
                        style={custom ? { backgroundColor: color, color: avatarInk(color) } : undefined}
                        className={`relative flex size-7 cursor-pointer items-center justify-center rounded-full border ${
                            custom ? 'border-transparent ring-2 ring-primary ring-offset-2' : 'border-dashed border-ink-gray text-ink-gray hover:bg-accent'
                        }`}
                    >
                        {custom ? <Check className="size-4" /> : <Pipette className="size-3.5" />}
                        <input
                            type="color"
                            value={color}
                            onChange={(e) => setColor(cleanAvatarColor(e.target.value) || color)}
                            aria-label={t('groups.avatar.customColor')}
                            className="absolute inset-0 size-full cursor-pointer opacity-0"
                        />
                    </label>
                </div>
            </div>

            <div className="sticky bottom-0 -mx-4 flex flex-col-reverse gap-2 border-t border-surface-border bg-white px-4 py-3 sm:flex-row sm:justify-end">
                <button
                    type="button"
                    onClick={onCancel}
                    className="inline-flex h-9 items-center justify-center rounded-md border border-surface-border bg-white px-4 text-sm font-medium text-primary hover:bg-accent"
                >
                    {t('common.cancel')}
                </button>
                <button
                    type="button"
                    onClick={() => onDone({ avatar_kind: value ? kind : '', avatar_value: value, avatar_color: color })}
                    className="inline-flex h-9 items-center justify-center gap-1.5 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90"
                >
                    <Check className="size-4" /> {t('groups.avatar.done')}
                </button>
            </div>
        </div>
    );
}
