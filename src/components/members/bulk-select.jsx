'use client';
import { KeyRound, UserPlus, X } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import { bulkAssignToGroup, bulkResetPasswords } from '@/app/actions/members';
import FormDialog from '@/components/ui/form-dialog';
import GroupChecklist from '@/components/ui/group-checklist';
import BulkEditDialog from './bulk-edit-dialog';
import { useT } from '@/lib/i18n/client';

/*
 * Row selection for bulk actions on the Members table. The table itself stays a server
 * component; these small client pieces share one selection through context:
 *   <BulkSelectProvider pageIds> … <SelectAll/> … <RowCheck id/> … <BulkBar groups/>
 * Selection covers the current page (the ids the server rendered).
 */
const Ctx = createContext(null);

export function BulkSelectProvider({ pageIds, children }) {
    const [selected, setSelected] = useState(() => new Set());
    // A new page / filter renders different rows: drop ids that are no longer on screen.
    const key = pageIds.join(',');
    const [seenKey, setSeenKey] = useState(key);
    if (seenKey !== key) {
        setSeenKey(key);
        setSelected((s) => new Set([...s].filter((id) => pageIds.includes(id))));
    }
    const toggle = (id) =>
        setSelected((s) => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });
    const all = pageIds.length > 0 && pageIds.every((id) => selected.has(id));
    const toggleAll = () => setSelected(all ? new Set() : new Set(pageIds));
    return <Ctx.Provider value={{ selected, toggle, all, toggleAll, clear: () => setSelected(new Set()) }}>{children}</Ctx.Provider>;
}

const box = 'size-4 cursor-pointer rounded accent-[var(--color-brand-orange-strong)]';

export function SelectAll() {
    const { t } = useT();
    const { all, toggleAll, selected } = useContext(Ctx);
    return (
        <input
            type="checkbox"
            checked={all}
            ref={(el) => {
                // Some-but-not-all selected shows the dash state.
                if (el) el.indeterminate = !all && selected.size > 0;
            }}
            onChange={toggleAll}
            aria-label={t('members.bulk.selectAll')}
            className={box}
        />
    );
}

export function RowCheck({ id, label }) {
    const { selected, toggle } = useContext(Ctx);
    return <input type="checkbox" checked={selected.has(id)} onChange={() => toggle(id)} aria-label={label} className={box} />;
}

/**
 * Bar above the table that appears once anyone is selected: Add to group (as members — group admins are made inside the group),
 * opening a dialog where one or more groups are ticked.
 * canReset adds "Reset password to phone" (for people who forgot theirs).
 * editCtx (app admins / sub-admins) adds "Bulk edit": status, role, village, city, caste, blood group, donor.
 * @param {{ groups: Array<{ value: string, label: string }>, canReset?: boolean, editCtx?: { villages: any[], cities: any[], casteOptions: any, roles: string[] } | null }} props
 */
export function BulkBar({ groups, canReset = false, editCtx = null }) {
    const { t } = useT();
    const { selected, clear } = useContext(Ctx);
    if (selected.size === 0) return null;
    const ids = [...selected];

    // Add to groups as members; making someone a group admin happens inside the group.
    const addToGroups = (
        <FormDialog
            title={t('members.addToGroup')}
            description={t('members.bulk.selected', { count: ids.length })}
            action={bulkAssignToGroup}
            submitIcon={UserPlus}
            submitLabel={t('common.apply')}
            width="sm:max-w-md"
            onSuccess={clear}
            trigger={({ open }) => (
                <button type="button" onClick={open} className="btn-secondary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium">
                    <UserPlus className="size-3.5" />
                    {t('members.addToGroup')}
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    {ids.map((id) => (
                        <input key={id} type="hidden" name="user_ids" value={id} />
                    ))}
                    {groups.length === 0 ? (
                        <p className="text-sm text-ink-gray">{t('members.noGroups')}</p>
                    ) : (
                        <div>
                            <GroupChecklist groups={groups} label={t('members.bulk.chooseGroups')} />
                            {fieldError('group_ids') && <p className="mt-1 text-xs font-medium text-destructive">{fieldError('group_ids')}</p>}
                            <p className="mt-1 text-xs text-ink-gray">{t('members.bulk.keepAdmins')}</p>
                        </div>
                    )}
                </>
            )}
        </FormDialog>
    );

    return (
        <div className="mt-4 -mb-1 flex flex-wrap items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
            <span className="text-sm font-semibold text-primary">{t('members.bulk.selected', { count: ids.length })}</span>
            <span className="flex-1" />
            {editCtx && <BulkEditDialog ids={ids} ctx={editCtx} onDone={clear} />}
            {groups.length > 0 && addToGroups}
            {canReset && (
                <FormDialog
                    title={t('members.bulk.resetTitle')}
                    description={t('members.bulk.selected', { count: ids.length })}
                    action={bulkResetPasswords}
                    submitIcon={KeyRound}
                    submitLabel={t('members.bulk.resetSubmit')}
                    width="sm:max-w-md"
                    onSuccess={clear}
                    trigger={({ open }) => (
                        <button type="button" onClick={open} className="btn-secondary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium">
                            <KeyRound className="size-3.5" /> {t('members.bulk.reset')}
                        </button>
                    )}
                >
                    {() => (
                        <>
                            {ids.map((id) => (
                                <input key={id} type="hidden" name="user_ids" value={id} />
                            ))}
                            <p className="rounded-md bg-amber-50 px-3 py-2 text-sm text-amber-900">{t('members.bulk.resetNote')}</p>
                        </>
                    )}
                </FormDialog>
            )}
            <button type="button" onClick={clear} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-gray hover:bg-accent hover:text-primary">
                <X className="size-3.5" /> {t('common.clear')}
            </button>
        </div>
    );
}
