'use client';
import { Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteContribution, deleteExpense } from '@/app/actions/fundraise';
import { KebabMenu, MenuItem } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

/** Kebab on a contribution / expense row. Destructive item last, per DESIGN.md §6. */
export default function RowActions({ kind, campaignId, rowId }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();

    function remove(close) {
        close();
        // A native confirm is the lightest guard for a one-row delete; the audit log keeps the amount.
        if (!window.confirm(t('fundraise.deleteEntryConfirm'))) return;
        startTransition(async () => {
            const fn = kind === 'expense' ? deleteExpense : deleteContribution;
            const res = await fn(campaignId, rowId);
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    }

    return (
        <div className={pending ? 'cursor-wait opacity-70' : ''}>
            <KebabMenu label={t('common.more')}>
                {(close) => (
                    <MenuItem icon={Trash2} danger disabled={pending} onClick={() => remove(close)}>
                        {t('common.delete')}
                    </MenuItem>
                )}
            </KebabMenu>
        </div>
    );
}
