'use client';
import { Plus, Save } from 'lucide-react';
import { startTransition, useActionState, useEffect, useState } from 'react';
import { toast } from 'sonner';
import { saveSurname, saveSurnamesBulk } from '@/app/actions/surnames';
import CasteSelect from '@/components/members/caste-select';
import { Field, textInput } from '@/components/ui/field';
import GujaratiField from '@/components/ui/gujarati-field';
import SubmitButton from '@/components/ui/submit-button';
import { useAutoGujarati } from '@/components/ui/use-auto-gujarati';
import { useT } from '@/lib/i18n/client';

/** One surname: its name, how many carry it, and its caste → sub-caste, saved on its own. */
function SurnameRow({ row, options, checked, onToggle }) {
    const { t, locale } = useT();
    const [state, action, pending] = useActionState(saveSurname, null);
    const [caste, setCaste] = useState({ caste: row.caste_id ? String(row.caste_id) : '', subcaste: row.subcaste_id ? String(row.subcaste_id) : '' });
    useEffect(() => {
        if (state?.ok) toast.success(t(state.message, state.vars));
        else if (state?.error) toast.error(t(state.error));
    }, [state, t]);
    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
    };
    const shown = (locale !== 'en' && row.name_local) || row.name;
    const other = locale !== 'en' ? row.name : row.name_local;
    return (
        <form onSubmit={onSubmit} className="grid items-end gap-3 px-4 py-3 sm:grid-cols-[minmax(0,1fr)_minmax(0,1fr)_minmax(0,1fr)_auto]">
            <input type="hidden" name="name" value={row.name} />
            <input type="hidden" name="name_local" value={row.name_local ?? ''} />
            <div className="flex min-w-0 items-center gap-3 self-center">
                <input
                    type="checkbox"
                    checked={checked}
                    onChange={onToggle}
                    aria-label={t('surnames.select', { name: shown })}
                    className="size-4 shrink-0 accent-brand-orange-strong"
                />
                <div className="min-w-0">
                <p className="truncate font-semibold text-primary">{shown}</p>
                <p className="truncate text-xs text-ink-gray">
                    {[other, t('surnames.members', { count: row.members })].filter(Boolean).join(' · ')}
                </p>
                </div>
            </div>
            <CasteSelect
                options={options}
                caste={caste.caste}
                subcaste={caste.subcaste}
                onChange={setCaste}
                names={{ caste: 'caste_id', subcaste: 'subcaste_id' }}
                errors={{ caste: state?.fieldErrors?.caste_id && t(state.fieldErrors.caste_id), subcaste: state?.fieldErrors?.subcaste_id && t(state.fieldErrors.subcaste_id) }}
            />
            <SubmitButton icon={Save} pending={pending} pendingText={t('common.saving')} size="h-9" className="sm:w-auto">
                {t('common.save')}
            </SubmitButton>
        </form>
    );
}

/** The new surname and its local spelling (filled in by itself); remounted after each save. */
function NewSurnameName({ error }) {
    const { t, localLang } = useT();
    const auto = useAutoGujarati('', '');
    return (
        <>
            <Field label={`${t('members.surname')} (${t('lang.en')})`} error={error} required>
                <input name="name" required maxLength={60} autoComplete="off" {...auto.enProps} className={`${textInput()} w-full`} />
            </Field>
            <GujaratiField label={`${t('members.surname')} (${localLang === 'hi' ? 'हिन्दी' : 'ગુજરાતી'})`} name="name_local" auto={auto} maxLength={60} />
        </>
    );
}

/** Add a surname nobody uses yet (with its local spelling, filled in by itself). */
function AddSurname({ options }) {
    const { t } = useT();
    const [state, action, pending] = useActionState(saveSurname, null);
    const [caste, setCaste] = useState({ caste: '', subcaste: '' });
    const [formKey, setFormKey] = useState(0);
    // A saved surname empties the form for the next one (render-time, not an effect).
    const [seen, setSeen] = useState(null);
    if (state !== seen) {
        setSeen(state);
        if (state?.ok) {
            setFormKey((k) => k + 1);
            setCaste({ caste: '', subcaste: '' });
        }
    }
    useEffect(() => {
        if (state?.ok) toast.success(t(state.message, state.vars));
    }, [state, t]);
    const onSubmit = (e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        startTransition(() => action(fd));
    };
    return (
        <form key={formKey} onSubmit={onSubmit} className="grid items-end gap-3 px-4 py-3 sm:grid-cols-2 xl:grid-cols-[repeat(4,minmax(0,1fr))_auto]">
            <NewSurnameName error={state?.fieldErrors?.name && t(state.fieldErrors.name)} />
            <CasteSelect options={options} caste={caste.caste} subcaste={caste.subcaste} onChange={setCaste} names={{ caste: 'caste_id', subcaste: 'subcaste_id' }} />
            <SubmitButton icon={Plus} pending={pending} pendingText={t('common.saving')} size="h-9" className="sm:w-auto">
                {t('common.add')}
            </SubmitButton>
        </form>
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
 * Members ⋮ → Surnames: every surname members already use (plus saved ones), each mapped to a
 * caste → sub-caste. Saving fills that caste into members with the surname who have none, and
 * new members (added, invited, registered, from a family tree) get it automatically.
 */
export default function SurnameManager({ surnames, options }) {
    const { t } = useT();
    // Tick several surnames to give them one caste → sub-caste at once.
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
    return (
        <div className="space-y-4">
            <section className="rounded-lg border border-surface-border bg-white shadow-sm">
                <h2 className="rounded-t-lg border-b border-surface-border bg-card-head px-4 py-2.5 text-sm font-semibold text-primary">{t('surnames.add')}</h2>
                <AddSurname options={options} />
            </section>
            <section className="rounded-lg border border-surface-border bg-white shadow-sm">
                <div className="flex items-center justify-between gap-2 rounded-t-lg border-b border-surface-border bg-card-head px-4 py-2.5">
                    <h2 className="text-sm font-semibold text-primary">{t('surnames.title')}</h2>
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
                </div>
                {selectedRows.length > 0 && <BulkAssign rows={selectedRows} options={options} onDone={() => setPicked(new Set())} />}
                {surnames.length === 0 ? (
                    <p className="px-4 py-6 text-sm text-ink-gray">{t('surnames.empty')}</p>
                ) : (
                    <div className="divide-y divide-surface-border">
                        {surnames.map((r) => (
                            <SurnameRow key={r.name} row={r} options={options} checked={picked.has(r.name)} onToggle={() => toggle(r.name)} />
                        ))}
                    </div>
                )}
            </section>
        </div>
    );
}
