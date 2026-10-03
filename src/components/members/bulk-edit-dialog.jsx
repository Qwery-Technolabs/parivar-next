'use client';
import { PencilLine, Plus, X } from 'lucide-react';
import { useState } from 'react';
import { bulkEditMembers } from '@/app/actions/members';
import CasteSelect from '@/components/members/caste-select';
import { selectInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import PickOrType from '@/components/ui/pick-or-type';
import { useT } from '@/lib/i18n/client';
import { BLOOD_GROUPS } from '@/lib/roles';

// What Bulk edit can change, in menu order.
const FIELDS = ['status', 'role', 'village', 'city', 'caste', 'blood_group', 'donor'];
// One column layout for the headings and every row: what to change | new value | remove.
const ROW_GRID = 'grid-cols-[minmax(0,1fr)_auto] sm:grid-cols-[11rem_minmax(0,1fr)_auto]';

/**
 * One change row: what to change ▾ — the new value — ×. The value control follows the field
 * (village / city: pick or type; caste: caste → sub-caste; donor: yes / no …). A field is offered
 * only once across the rows. The value inputs carry the field's own name, posted with change[].
 */
function ChangeRow({ row, used, onField, onRemove, removable, ctx, fieldError }) {
    const { t } = useT();
    const [caste, setCaste] = useState({ caste: '', subcaste: '' });
    const label = (f) => t(`members.bulkEdit.fields.${f}`);
    const value = () => {
        switch (row.field) {
            case 'status':
                return (
                    <select name="status" defaultValue="active" className={`${selectInput(!!fieldError('status'))} w-full`}>
                        {['active', 'inactive', 'deceased'].map((s) => (
                            <option key={s} value={s}>
                                {t(`status.${s}`)}
                            </option>
                        ))}
                    </select>
                );
            case 'role':
                return (
                    <select name="role" defaultValue={ctx.roles.includes('sabhyo') ? 'sabhyo' : ctx.roles[0]} className={`${selectInput(!!fieldError('role'))} w-full`}>
                        {ctx.roles.map((r) => (
                            <option key={r} value={r}>
                                {t(`roles.${r}`)}
                            </option>
                        ))}
                    </select>
                );
            case 'village':
                return <PickOrType name="village" defaultValue="" suggestions={ctx.villages} label={label('village')} />;
            case 'city':
                return <PickOrType name="city" defaultValue="" suggestions={ctx.cities} label={label('city')} />;
            case 'caste':
                return (
                    <div className="grid gap-2 sm:grid-cols-2">
                        <CasteSelect
                            options={ctx.casteOptions}
                            caste={caste.caste}
                            subcaste={caste.subcaste}
                            onChange={setCaste}
                            names={{ caste: 'caste_id', subcaste: 'subcaste_id' }}
                            errors={{ caste: fieldError('caste_id'), subcaste: fieldError('subcaste_id') }}
                        />
                    </div>
                );
            case 'blood_group':
                return (
                    <select name="blood_group" defaultValue="" className={`${selectInput()} w-full`}>
                        <option value="">—</option>
                        {BLOOD_GROUPS.map((g) => (
                            <option key={g} value={g}>
                                {g}
                            </option>
                        ))}
                    </select>
                );
            case 'donor':
                return (
                    <select name="is_blood_donor" defaultValue="1" className={`${selectInput()} w-full`}>
                        <option value="1">{t('common.yes')}</option>
                        <option value="0">{t('common.no')}</option>
                    </select>
                );
            default:
                return null;
        }
    };
    return (
        <div className={`grid items-start gap-2 ${ROW_GRID}`}>
            {row.field && <input type="hidden" name="change" value={row.field} />}
            <select
                value={row.field}
                onChange={(e) => onField(e.target.value)}
                aria-label={t('members.bulkEdit.what')}
                // Phones: what + × on the first line, the value full-width below; from sm: one line.
                className={`${selectInput()} col-start-1 row-start-1 w-full`}
            >
                <option value="" disabled>
                    {t('members.bulkEdit.what')}
                </option>
                {FIELDS.filter((f) => f === row.field || !used.includes(f)).map((f) => (
                    <option key={f} value={f}>
                        {label(f)}
                    </option>
                ))}
            </select>
            {/* key: switching the field gives a fresh value control */}
            <div key={row.field} className="col-span-2 min-w-0 sm:col-span-1">
                {row.field ? value() : <p className="py-2 text-xs text-ink-gray">{t('members.bulkEdit.pickFirst')}</p>}
            </div>
            <button
                type="button"
                onClick={onRemove}
                disabled={!removable}
                aria-label={t('common.remove')}
                title={t('common.remove')}
                className="col-start-2 row-start-1 flex size-9 shrink-0 items-center sm:col-start-3 justify-center rounded-md border border-surface-border bg-white text-ink-gray hover:border-destructive/40 hover:bg-destructive/10 hover:text-destructive disabled:opacity-30"
            >
                <X className="size-4" />
            </button>
        </div>
    );
}

function ChangeRows({ ctx, fieldError }) {
    const { t } = useT();
    const [rows, setRows] = useState([{ key: 1, field: '' }]);
    const used = rows.map((r) => r.field).filter(Boolean);
    const next = FIELDS.find((f) => !used.includes(f));
    return (
        <div className="space-y-2">
            {/* Column headings, like a line-item table (from sm up). */}
            <div className={`hidden gap-2 ${ROW_GRID} text-[11px] font-semibold uppercase tracking-wide text-ink-gray sm:grid`}>
                <span>{t('members.bulkEdit.what')}</span>
                <span>{t('members.bulkEdit.value')}</span>
                <span className="w-9" />
            </div>
            {rows.map((row) => (
                <ChangeRow
                    key={row.key}
                    row={row}
                    used={used}
                    ctx={ctx}
                    fieldError={fieldError}
                    removable={rows.length > 1}
                    onField={(f) => setRows((list) => list.map((r) => (r.key === row.key ? { ...r, field: f } : r)))}
                    onRemove={() => setRows((list) => list.filter((r) => r.key !== row.key))}
                />
            ))}
            {next && rows.length < FIELDS.length && (
                <div className="flex justify-end">
                    <button
                        type="button"
                        onClick={() => setRows((list) => [...list, { key: Date.now(), field: '' }])}
                        className="inline-flex h-9 items-center gap-1.5 rounded-md border border-surface-border bg-white px-3 text-sm font-medium text-primary hover:bg-accent"
                    >
                        <Plus className="size-4" /> {t('members.bulkEdit.addChange')}
                    </button>
                </div>
            )}
            <p className="text-xs text-ink-gray">{t('members.bulkEdit.note')}</p>
        </div>
    );
}

/**
 * "Bulk edit" on the Members bulk bar (app admins / sub-admins): set status, role, native village,
 * current city, caste → sub-caste, blood group or donor for every ticked person at once.
 * `ctx`: { villages, cities, casteOptions, roles } — the same choices as the member form.
 */
export default function BulkEditDialog({ ids, ctx, onDone }) {
    const { t } = useT();
    return (
        <FormDialog
            title={t('members.bulkEdit.title')}
            description={t('members.bulk.selected', { count: ids.length })}
            action={bulkEditMembers}
            submitIcon={PencilLine}
            submitLabel={t('common.apply')}
            width="sm:max-w-2xl"
            onSuccess={onDone}
            trigger={({ open }) => (
                <button type="button" onClick={open} className="btn-secondary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium">
                    <PencilLine className="size-3.5" /> {t('members.bulkEdit.button')}
                </button>
            )}
        >
            {({ fieldError }) => (
                <>
                    {ids.map((id) => (
                        <input key={id} type="hidden" name="user_ids" value={id} />
                    ))}
                    <ChangeRows ctx={ctx} fieldError={fieldError} />
                </>
            )}
        </FormDialog>
    );
}
