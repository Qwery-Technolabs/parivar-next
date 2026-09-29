'use client';
import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { clearAuditLog } from '@/app/actions/audit';
import { useT } from '@/lib/i18n/client';

/**
 * Activity log → delete the entries the current filter shows (all of them when no filter).
 * Administrators only; asks first; the server records the clearing as a new entry.
 * @param {{ entity: string, q: string, actor?: number|null, count: number }} props
 */
export default function ClearLogButton({ entity, q, actor = null, count }) {
    const { t } = useT();
    const router = useRouter();
    const [pending, startTransition] = useTransition();
    return (
        <button
            type="button"
            disabled={pending}
            onClick={() => {
                if (!window.confirm(t('audit.clearConfirm', { count }))) return;
                startTransition(async () => {
                    const res = await clearAuditLog(entity, q, actor);
                    if (res?.error) return toast.error(t(res.error));
                    toast.success(t('audit.cleared', { count: res.count }));
                    router.refresh();
                });
            }}
            className="inline-flex h-7 items-center gap-1 rounded-md border border-destructive/40 bg-white px-2 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
        >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
            {t('audit.clear', { count })}
        </button>
    );
}
