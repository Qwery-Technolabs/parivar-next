'use client';
import { Loader2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

/**
 * Runs a pre-bound server action (e.g. `cancelMeeting.bind(null, campaignId, meetingId)`)
 * after an optional confirm, and toasts its `{ ok, message } | { error }` result.
 * `icon` is a rendered element (<Trash2 />), not a component: a component function cannot
 * cross from a server component into this client one. Swapped for a spinner while pending.
 */
export default function ActionButton({ action, confirm, icon, children, danger = false, plain = false, label, className = '' }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    return (
        <button
            type="button"
            disabled={pending}
            aria-label={label}
            title={label}
            onClick={() => {
                if (confirm && !window.confirm(confirm)) return;
                startTransition(async () => {
                    const res = await action();
                    if (res?.ok) toast.success(t(res.message));
                    else if (res) toast.error(t(res.error ?? 'common.error')); // nothing back = it redirected
                });
            }}
            className={`inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-2.5 text-xs font-medium disabled:opacity-60 ${
                plain ? '' : danger ? 'text-destructive hover:bg-destructive/10' : 'btn-secondary'
            } ${className}`}
        >
            {pending ? <Loader2 className="size-3.5 animate-spin" /> : icon}
            {children}
        </button>
    );
}
