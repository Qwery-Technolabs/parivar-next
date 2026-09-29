'use client';
import { Phone, UserRoundSearch } from 'lucide-react';
import { useState } from 'react';
import { Field, textInput } from '@/components/ui/field';
import MemberPicker from '@/components/ui/member-picker';
import { useT } from '@/lib/i18n/client';

/**
 * Pick a registered member, or type a mobile number (registered or not — the server invites
 * a new number: lib/invite.js). Posts `mode` = member | phone, then either `pickerName`
 * or phone + full_name. Used by the group "Add member" and the "Add relation" dialogs.
 * @param {{ fieldError: (name: string) => string|null, pickerName: string, exclude?: number[], allowPhone?: boolean }} props
 */
export default function PersonOrPhone({ fieldError, pickerName, exclude = [], allowPhone = true }) {
    const { t } = useT();
    const [mode, setMode] = useState('member');
    const modes = [
        { key: 'member', label: t('groups.invite.existing'), Icon: UserRoundSearch },
        { key: 'phone', label: t('groups.invite.byPhone'), Icon: Phone },
    ];
    const picker = (
        <Field label={t('relations.person')} error={fieldError(pickerName)} required>
            <MemberPicker name={pickerName} exclude={exclude} hasError={!!fieldError(pickerName)} />
        </Field>
    );
    if (!allowPhone) return picker;

    return (
        <>
            <input type="hidden" name="mode" value={mode} />
            <div role="tablist" className="grid grid-cols-2 rounded-md border border-surface-border p-0.5">
                {modes.map(({ key, label, Icon }) => (
                    <button
                        key={key}
                        type="button"
                        role="tab"
                        aria-selected={mode === key}
                        onClick={() => setMode(key)}
                        className={`inline-flex h-8 items-center justify-center gap-1.5 rounded text-xs font-medium ${mode === key ? 'seg-active' : 'text-ink-gray hover:text-primary'}`}
                    >
                        <Icon className="size-3.5" /> {label}
                    </button>
                ))}
            </div>
            {mode === 'member' ? (
                picker
            ) : (
                <>
                    <Field label={t('members.phone')} hint={t('groups.invite.phoneHint')} error={fieldError('phone')} required>
                        <input name="phone" type="tel" inputMode="numeric" required className={`${textInput(!!fieldError('phone'))} w-full tabular-nums`} />
                    </Field>
                    <Field label={t('groups.invite.nameOptional')}>
                        <input name="full_name" maxLength={150} autoComplete="off" className={`${textInput()} w-full`} />
                    </Field>
                    <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-900">{t('groups.invite.passwordNote')}</p>
                </>
            )}
        </>
    );
}
