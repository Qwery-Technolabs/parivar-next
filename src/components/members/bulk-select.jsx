'use client';
import { ShieldCheck, UserPlus, X } from 'lucide-react';
import { createContext, useContext, useState } from 'react';
import { bulkAssignToGroup } from '@/app/actions/members';
import FormDialog from '@/components/ui/form-dialog';
import GroupChecklist from '@/components/ui/group-checklist';
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
 * Bar above the table that appears once anyone is selected: Add to group / Make group admin, each
 * opening a dialog where one or more groups are ticked.
 * @param {{ groups: Array<{ value: string, label: string }> }} props
 */
export function BulkBar({ groups }) {
    const { t } = useT();
    const { selected, clear } = useContext(Ctx);
    if (selected.size === 0) return null;
    const ids = [...selected];

    const dialog = (role) => (
        <FormDialog
            key={role}
            title={role === 'admin' ? t('members.makeGroupAdmin') : t('members.addToGroup')}
            description={t('members.bulk.selected', { count: ids.length })}
            action={bulkAssignToGroup}
            hidden={{ member_role: role }}
            submitIcon={role === 'admin' ? ShieldCheck : UserPlus}
            submitLabel={t('common.apply')}
            width="sm:max-w-md"
            onSuccess={clear}
            trigger={({ open }) => (
                <button type="button" onClick={open} className="btn-secondary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium">
                    {role === 'admin' ? <ShieldCheck className="size-3.5" /> : <UserPlus className="size-3.5" />}
                    {role === 'admin' ? t('members.makeGroupAdmin') : t('members.addToGroup')}
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
                            {role === 'member' && <p className="mt-1 text-xs text-ink-gray">{t('members.bulk.keepAdmins')}</p>}
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
            {groups.length > 0 && ['member', 'admin'].map(dialog)}
            <button type="button" onClick={clear} className="inline-flex h-8 items-center gap-1 rounded-md px-2 text-xs font-medium text-ink-gray hover:bg-accent hover:text-primary">
                <X className="size-3.5" /> {t('common.clear')}
            </button>
        </div>
    );
}
