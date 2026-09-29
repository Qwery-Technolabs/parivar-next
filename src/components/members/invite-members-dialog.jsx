'use client';
import { Plus, Send, Smartphone, X } from 'lucide-react';
import { useRef, useState } from 'react';
import { inviteMembers } from '@/app/actions/members';
import { textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import GroupChecklist from '@/components/ui/group-checklist';
import { useT } from '@/lib/i18n/client';
import { MenuOpener } from '@/components/shell/page-menu';

const MAX_ROWS = 50;

/**
 * "Invite by phone" on the Members page: rows of mobile number + name, as many as needed,
 * and optionally groups to join. First password = the number (actions/members.js inviteMembers).
 * @param {{ groups: Array<{ value: string, label: string }> }} props
 */
export default function InviteMembersDialog({ groups, menuKey }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('members.invite.title')}
            description={t('members.invite.description')}
            action={inviteMembers}
            submitIcon={Send}
            submitLabel={t('members.invite.submit')}
            width="sm:max-w-xl"
            trigger={({ open }) =>
                menuKey ? (
                    <MenuOpener id={menuKey} open={open} />
                ) : (
                <button
                    type="button"
                    onClick={open}
                    className="btn-secondary inline-flex h-9 flex-1 shrink-0 items-center justify-center gap-2 rounded-md px-3 text-sm font-medium sm:flex-none"
                >
                    <Smartphone className="size-4" /> {t('members.invite.button')}
                </button>
                )
            }
        >
            {() => <InviteRows groups={groups} />}
        </FormDialog>
    );
}

/**
 * A pasted list → { phone, name } entries. One person per line (or ";"); a line of numbers
 * only may also be comma-separated. Each line's phone is the first run of digits (with an
 * optional +, spaces, dashes, dots or brackets); whatever text is left is the name.
 * "+91 98250 12345", "919825012345" and "09825012345" are all fine — the server reads them
 * as one number.
 */
function parsePasted(text) {
    const lines = String(text)
        .split(/\r?\n|;/)
        .flatMap((l) => (/[a-z\u0A80-\u0AFF\u0900-\u097F]/i.test(l) ? [l] : l.split(',')))
        .map((l) => l.trim())
        .filter(Boolean);
    const out = [];
    for (const line of lines) {
        const m = line.match(/\+?\d[\d\s\-().]{7,}\d/);
        if (!m) continue;
        const phone = m[0].replace(/[^\d+]/g, '');
        const name = (line.slice(0, m.index) + ' ' + line.slice(m.index + m[0].length)).replace(/[,:|\-–]+/g, ' ').replace(/\s+/g, ' ').trim();
        out.push({ phone, name });
    }
    return out;
}

const digits = (p) => String(p).replace(/\D/g, '').replace(/^91(?=\d{10}$)/, '').replace(/^0(?=\d{10}$)/, '');

function InviteRows({ groups }) {
    const { t } = useT();
    const next = useRef(1);
    const [rows, setRows] = useState([{ id: 0, phone: '', name: '' }]);
    const set = (id, patch) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
    const add = () => {
        if (rows.length >= MAX_ROWS) return;
        const id = next.current++;
        setRows((r) => [...r, { id, phone: '', name: '' }]);
        // Focus the new row's number once it renders.
        requestAnimationFrame(() => document.getElementById(`invite-phone-${id}`)?.focus());
    };

    // Pasting several numbers into a phone box spreads them over rows: the first fills this
    // row, the rest get new rows right after it. Numbers already listed are skipped.
    const onPaste = (id) => (e) => {
        const entries = parsePasted(e.clipboardData.getData('text'));
        if (entries.length < 2 && !(entries.length === 1 && entries[0].name)) return; // a single number: normal paste
        e.preventDefault();
        setRows((r) => {
            const at = r.findIndex((x) => x.id === id);
            const seen = new Set(r.filter((x) => x.id !== id && x.phone).map((x) => digits(x.phone)));
            const fresh = entries.filter((en) => {
                const key = digits(en.phone);
                if (seen.has(key)) return false;
                seen.add(key);
                return true;
            });
            if (!fresh.length) return r;
            const [first, ...rest] = fresh;
            const current = { ...r[at], phone: first.phone, name: r[at].name || first.name };
            const room = MAX_ROWS - r.length;
            const added = rest.slice(0, Math.max(0, room)).map((en) => ({ id: next.current++, phone: en.phone, name: en.name }));
            return [...r.slice(0, at), current, ...added, ...r.slice(at + 1)];
        });
    };

    return (
        <>
            <div className="space-y-2">
                <p className="rounded-md bg-accent px-3 py-2 text-xs text-primary">{t('members.invite.pasteHint')}</p>
                <div className="hidden grid-cols-[1fr_1.4fr_2rem] gap-2 text-xs font-medium text-ink-gray sm:grid">
                    <span>
                        {t('members.invite.phone')} <span className="font-normal tabular-nums">({rows.length})</span>
                    </span>
                    <span>{t('members.invite.name')}</span>
                </div>
                {rows.map((row, i) => (
                    <div key={row.id} className="grid grid-cols-[1fr_2rem] gap-2 sm:grid-cols-[1fr_1.4fr_2rem]">
                        <input
                            id={`invite-phone-${row.id}`}
                            name="phone"
                            type="tel"
                            inputMode="numeric"
                            value={row.phone}
                            onChange={(e) => set(row.id, { phone: e.target.value })}
                            onPaste={onPaste(row.id)}
                            placeholder={t('members.invite.phone')}
                            aria-label={`${t('members.invite.phone')} ${i + 1}`}
                            className={`${textInput()} w-full min-w-0 tabular-nums`}
                        />
                        <button
                            type="button"
                            onClick={() => setRows((r) => (r.length > 1 ? r.filter((x) => x.id !== row.id) : r))}
                            disabled={rows.length === 1}
                            aria-label={t('members.invite.removeRow')}
                            className="order-last flex size-9 items-center justify-center rounded-md text-ink-gray hover:bg-accent hover:text-destructive disabled:opacity-30 sm:order-none sm:col-start-3 sm:row-start-1"
                        >
                            <X className="size-4" />
                        </button>
                        <input
                            name="full_name"
                            maxLength={150}
                            value={row.name}
                            onChange={(e) => set(row.id, { name: e.target.value })}
                            placeholder={t('members.invite.name')}
                            aria-label={`${t('members.invite.name')} ${i + 1}`}
                            className={`${textInput()} col-span-2 w-full min-w-0 sm:col-span-1 sm:col-start-2 sm:row-start-1`}
                        />
                    </div>
                ))}
                <button
                    type="button"
                    onClick={add}
                    disabled={rows.length >= MAX_ROWS}
                    className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-primary hover:bg-accent disabled:opacity-50"
                >
                    <Plus className="size-4" /> {t('members.invite.addRow')}
                </button>
            </div>
            {groups.length > 0 && <GroupChecklist groups={groups} label={t('members.invite.groups')} />}
        </>
    );
}
