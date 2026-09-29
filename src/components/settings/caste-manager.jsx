'use client';
import { Eye, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteCaste, saveCaste, setCasteStatus } from '@/app/actions/castes';
import Badge from '@/components/ui/badge';
import { Field, textInput } from '@/components/ui/field';
import FormDialog from '@/components/ui/form-dialog';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

function CasteDialog({ caste, parent, trigger }) {
    const { t } = useT();
    const isEdit = Boolean(caste);
    const title = isEdit ? t('castes.edit') : parent ? t('castes.addSub') : t('castes.add');
    return (
        <FormDialog
            title={title}
            description={parent ? parent.name : undefined}
            action={saveCaste}
            hidden={{ id: caste?.id ?? '', parent_id: parent?.id ?? '' }}
            submitIcon={isEdit ? Pencil : Plus}
            width="sm:max-w-md"
            trigger={trigger}
        >
            {({ fieldError }) => (
                <>
                    <Field label={t('castes.name')} error={fieldError('name')} required>
                        <input name="name" defaultValue={caste?.name ?? ''} required maxLength={100} className={`${textInput(!!fieldError('name'))} w-full`} />
                    </Field>
                    <Field label={t('castes.nameGu')}>
                        <input name="name_gu" lang="gu" defaultValue={caste?.name_gu ?? ''} maxLength={100} className={`${textInput()} w-full`} />
                    </Field>
                    <Field label={t('castes.sortOrder')} hint={t('castes.sortHint')}>
                        <input name="sort_order" type="number" min={0} max={9999} defaultValue={caste?.sort_order ?? 0} className={`${textInput()} w-32 tabular-nums`} />
                    </Field>
                </>
            )}
        </FormDialog>
    );
}

function Row({ c, parent, run, pending }) {
    const { t, locale } = useT();
    const name = (locale === 'gu' && c.name_gu) || c.name;
    const other = locale === 'gu' ? c.name : c.name_gu;
    return (
        <div className={`flex items-center gap-3 py-2.5 pr-2 ${parent ? 'pl-10' : 'pl-4'} ${c.status === 'inactive' ? 'opacity-60' : ''}`}>
            <div className="min-w-0 flex-1">
                <span className={`break-words text-sm text-primary ${parent ? '' : 'font-semibold'}`}>{name}</span>
                {other && other !== name && <span className="ml-2 text-xs text-ink-gray">{other}</span>}
                {c.status === 'inactive' && (
                    <Badge status="inactive" className="ml-2">
                        {t('status.inactive')}
                    </Badge>
                )}
            </div>
            <span className="shrink-0 text-xs tabular-nums text-ink-gray">{t('members.count', { count: c.members })}</span>
            <CasteDialog
                caste={c}
                parent={parent}
                trigger={({ open: openEdit }) => (
                    <KebabMenu label={t('common.more')}>
                        {(close) => (
                            <>
                                <MenuItem
                                    icon={Pencil}
                                    onClick={() => {
                                        close();
                                        openEdit();
                                    }}
                                >
                                    {t('common.edit')}
                                </MenuItem>
                                <MenuItem
                                    icon={c.status === 'active' ? EyeOff : Eye}
                                    disabled={pending}
                                    onClick={() => {
                                        close();
                                        run(() => setCasteStatus(c.id, c.status === 'active' ? 'inactive' : 'active'));
                                    }}
                                >
                                    {c.status === 'active' ? t('castes.deactivate') : t('castes.activate')}
                                </MenuItem>
                                <MenuSeparator />
                                <MenuItem
                                    icon={Trash2}
                                    danger
                                    disabled={pending || c.members > 0}
                                    onClick={() => {
                                        close();
                                        if (window.confirm(t('common.confirmDelete'))) run(() => deleteCaste(c.id));
                                    }}
                                >
                                    {t('common.delete')}
                                </MenuItem>
                            </>
                        )}
                    </KebabMenu>
                )}
            />
        </div>
    );
}

export default function CasteManager({ castes }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    const run = (fn) =>
        startTransition(async () => {
            const res = await fn();
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });

    return (
        <div className={pending ? 'cursor-wait opacity-70' : ''}>
            <div className="mb-3 flex justify-end">
                <CasteDialog
                    trigger={({ open }) => (
                        <button
                            type="button"
                            onClick={open}
                            className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-white hover:bg-primary/90 sm:w-auto"
                        >
                            <Plus className="size-4" /> {t('castes.add')}
                        </button>
                    )}
                />
            </div>
            {castes.length === 0 ? (
                <p className="rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">{t('castes.empty')}</p>
            ) : (
                <div className="divide-y divide-surface-border overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
                    {castes.map((c) => (
                        <div key={c.id}>
                            <Row c={c} run={run} pending={pending} />
                            {c.children.map((s) => (
                                <Row key={s.id} c={s} parent={c} run={run} pending={pending} />
                            ))}
                            <div className="pb-2 pl-10">
                                <CasteDialog
                                    parent={c}
                                    trigger={({ open }) => (
                                        <button
                                            type="button"
                                            onClick={open}
                                            className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-xs font-medium text-ink-gray hover:bg-accent hover:text-primary"
                                        >
                                            <Plus className="size-3.5" /> {t('castes.addSub')}
                                        </button>
                                    )}
                                />
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
