'use client';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';
import { formatPhone, normalizePhone } from '@/lib/phone';
import Combobox from './combobox';

/**
 * Combobox over /api/members/search. Controlled or uncontrolled; posts `name` as the user id.
 * allowInvite: typing a phone number that is not a member offers "Invite <number>"; picking it
 * posts `phone:<digits>` (the server invites that number — lib/invite.js).
 * @param {{ name?: string, defaultValue?: {id: string|number, label: string} | null, onPick?: (opt: any) => void, placeholder?: string, hasError?: boolean, exclude?: Array<string|number>, allowInvite?: boolean }} props
 */
export default function MemberPicker({ name, defaultValue = null, onPick, placeholder, hasError, exclude = [], allowInvite = false }) {
    const { t, locale } = useT();
    const [sel, setSel] = useState(defaultValue ? { value: String(defaultValue.id), label: defaultValue.label } : null);
    const skip = new Set(exclude.map(String));

    return (
        <Combobox
            name={name}
            value={sel?.value ?? ''}
            valueLabel={sel?.label ?? ''}
            placeholder={placeholder ?? t('groups.pickMember')}
            hasError={hasError}
            emptyText={t('common.noResults')}
            fetchOptions={async (q) => {
                const res = await fetch(`/api/members/search?q=${encodeURIComponent(q)}`);
                if (!res.ok) return [];
                const rows = await res.json();
                const found = rows.filter((r) => !skip.has(r.value)).map((r) => ({ ...r, label: (locale === 'gu' && r.labelLocal) || r.label }));
                // A phone number nobody has yet: offer to invite it.
                const phone = allowInvite ? normalizePhone(q) : null;
                if (phone && !rows.some((r) => r.phone === phone)) {
                    found.push({ value: `phone:${phone}`, label: t('members.invite.pickerInvite', { phone: formatPhone(phone) }), invite: true });
                }
                return found;
            }}
            onSelect={(opt) => {
                setSel(opt);
                onPick?.(opt);
            }}
        />
    );
}
