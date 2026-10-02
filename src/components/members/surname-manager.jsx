'use client';
import { Pencil, Plus, Save } from 'lucide-react';
import { startTransition, useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { saveSurname, saveSurnamesBulk } from '@/app/actions/surnames';
import CasteSelect from '@/components/members/caste-select';
import { Field, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import GujaratiField from '@/components/ui/gujarati-field';
import SubmitButton from '@/components/ui/submit-button';
import { useAutoGujarati } from '@/components/ui/use-auto-gujarati';
import { useT } from '@/lib/i18n/client';

/**
 * The fields of the Add / Edit popup: the surname (fixed when editing), its local spelling with
 * Google's suggestions, and its caste → sub-caste. A component of its own, so its hooks remount
 * with the dialog's form each time it opens.
 */
function SurnameFields({ row, options, fieldError }) {
    const { t, localLang } = useT();
    const auto = useAutoGujarati(row?.name ?? '', row?.name_local ?? '', 'surname');
    const [caste, setCaste] = useState({ caste: row?.caste_id ? String(row.caste_id) : '', subcaste: row?.subcaste_id ? String(row.subcaste_id) : '' });
    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {row ? (
                <input type="hidden" name="name" value={row.name} />
            ) : (
                <Field label={`${t('members.surname')} (${t('lang.en')})`} error={fieldError('name')} required>
                    <input name="name" required maxLength={60} autoComplete="off" {...auto.enProps} className={`${textInput(!!fieldError('name'))} w-full`} />
                </Field>
            )}
            <GujaratiField
                label={`${t('members.surname')} (${localLang === 'hi' ? 'हिन्दी' : 'ગુજરાતી'})`}
                name="name_local"
                auto={auto}
                maxLength={60}
                className={row ? 'sm:col-span-2' : ''}
            />
            <CasteSelect
                options={options}
                caste={caste.caste}
                subcaste={caste.subcaste}
                onChange={setCaste}
                names={{ caste: 'caste_id', subcaste: 'subcaste_id' }}
                errors={{ caste: fieldError('caste_id'), subcaste: fieldError('subcaste_id') }}
            />
        </div>
    );
}

/** Add (no `row`) or edit one surname, in a small popup. */
function SurnameDialog({ row = null, options, trigger }) {
    const { t } = useT();
    return (
        <FormDialog
            title={row ? row.name : t('surnames.add')}
            action={saveSurname}
            submitIcon={row ? Save : Plus}
            submitLabel={row ? t('common.save') : t('common.add')}
            width="sm:max-w-md"
            trigger={trigger}
        >
            {({ fieldError }) => <SurnameFields row={row} options={options} fieldError={fieldError} />}
        </FormDialog>
    );
}

/** The bar for ticked surnames: one caste → sub-caste for all of them. */
function BulkAssign({ rows, options, onDone }) {
    const { t } = useT();
    const [state, action, pending] = useActionState(saveSurnamesBulk, null);
    const [caste, setCaste] = useState({ caste: '', subcaste: '' });
    useEffect(() => {
        if (state?.ok) {
            toast.success(t(state.message, state.vars));
            onDone();
        } else if (state?.error) toast.error(t(state.error));
    }, [state, t, onDone]);
    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
    };
    return (
        <form onSubmit={onSubmit} className="grid items-end gap-3 border-b border-surface-border bg-accent/50 px-4 py-3 sm:grid-cols-[auto_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input type="hidden" name="rows" value={JSON.stringify(rows.map((r) => ({ name: r.name, name_local: r.name_local })))} />
            <p className="self-center text-sm font-semibold text-primary">{t('surnames.selected', { count: rows.length })}</p>
            <CasteSelect
                options={options}
                caste={caste.caste}
                subcaste={caste.subcaste}
                onChange={setCaste}
                names={{ caste: 'caste_id', subcaste: 'subcaste_id' }}
                errors={{ caste: state?.fieldErrors?.caste_id && t(state.fieldErrors.caste_id) }}
            />
            <SubmitButton icon={Save} pending={pending} pendingText={t('common.saving')} size="h-9" className="sm:w-auto">
                {t('surnames.assignSelected')}
            </SubmitButton>
        </form>
    );
}

/**
 * Members ⋮ → Surnames: a compact list of every surname members already use (plus saved ones) —
 * name, local spelling, how many carry it, caste → sub-caste — with Edit in a small popup (local
 * spelling with Google's suggestions, caste). Saving fills that caste into members with the
 * surname who have none, and new members (added, invited, registered, from a family tree) get it.
 * Tick several to give them one caste → sub-caste at once.
 */
export default function SurnameManager({ surnames, options }) {
    const { t, locale } = useT();
    const [picked, setPicked] = useState(() => new Set());
    const toggle = (name) =>
        setPicked((s) => {
            const n = new Set(s);
            if (n.has(name)) n.delete(name);
            else n.add(name);
            return n;
        });
    const allPicked = surnames.length > 0 && picked.size === surnames.length;
    const selectedRows = surnames.filter((r) => picked.has(r.name));
    const casteLabel = (r) => {
        const c = options.castes.find((o) => o.value === String(r.caste_id ?? ''));
        if (!c) return null;
        const s = (options.subcastes[c.value] ?? []).find((o) => o.value === String(r.subcaste_id ?? ''));
        return s ? `${c.label} → ${s.label}` : c.label;
    };
    const editButton = ({ open }) => (
        <button
            type="button"
            onClick={open}
            aria-label={t('common.edit')}
            title={t('common.edit')}
            className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center gap-1.5 rounded-md text-xs font-medium sm:w-auto sm:px-2.5"
        >
            <Pencil className="size-3.5" /> <span className="hidden sm:inline">{t('common.edit')}</span>
        </button>
    );

    return (
        <section className="rounded-lg border border-surface-border bg-white shadow-sm">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-t-lg border-b border-surface-border bg-card-head px-4 py-2">
                <h2 className="text-sm font-semibold text-primary">{t('surnames.title')}</h2>
                <div className="flex items-center gap-3">
                    {surnames.length > 0 && (
                        <label className="inline-flex items-center gap-2 text-xs font-medium text-primary">
                            <input
                                type="checkbox"
                                checked={allPicked}
                                onChange={() => setPicked(allPicked ? new Set() : new Set(surnames.map((r) => r.name)))}
                                className="size-4 accent-brand-orange-strong"
                            />
                            {t('surnames.selectAll')}
                        </label>
                    )}
                    <SurnameDialog
                        options={options}
                        trigger={({ open }) => (
                            <button type="button" onClick={open} className="btn-secondary inline-flex h-8 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium">
                                <Plus className="size-3.5" /> {t('surnames.add')}
                            </button>
                        )}
                    />
                </div>
            </div>
            {selectedRows.length > 0 && <BulkAssign rows={selectedRows} options={options} onDone={() => setPicked(new Set())} />}
            {surnames.length === 0 ? (
                <p className="px-4 py-6 text-sm text-ink-gray">{t('surnames.empty')}</p>
            ) : (
                <ul className="divide-y divide-surface-border">
                    {surnames.map((r) => {
                        const shown = (locale !== 'en' && r.name_local) || r.name;
                        const other = locale !== 'en' ? r.name : r.name_local;
                        const caste = casteLabel(r);
                        return (
                            <li key={r.name} className="flex items-center gap-3 px-4 py-2">
                                <input
                                    type="checkbox"
                                    checked={picked.has(r.name)}
                                    onChange={() => toggle(r.name)}
                                    aria-label={t('surnames.select', { name: shown })}
                                    className="size-4 shrink-0 accent-brand-orange-strong"
                                />
                                <div className="min-w-0 flex-1">
                                    <p className="truncate text-sm font-semibold text-primary">
                                        {shown}
                                        {other && <span className="ml-1.5 font-normal text-ink-gray">{other}</span>}
                                    </p>
                                    <p className="truncate text-xs text-ink-gray">
                                        {t('surnames.members', { count: r.members ?? 0 })}
                                        {' · '}
                                        {caste ? <span className="text-ink">{caste}</span> : <span className="italic">{t('surnames.noCaste')}</span>}
                                    </p>
                                </div>
                                <SurnameDialog row={r} options={options} trigger={editButton} />
                            </li>
                        );
                    })}
                </ul>
            )}
        </section>
    );
}
