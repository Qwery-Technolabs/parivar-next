'use client';
import { Loader2, LogIn, Trash2 } from 'lucide-react';
import { useEffect, useState, useTransition } from 'react';
import { toast } from 'sonner';
import { clearAuditLog, loadMemberActivity } from '@/app/actions/audit';
import Badge from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { date, time } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

// DATETIME arrives as 'YYYY-MM-DD HH:MM:SS' (app timezone).
const when = (v, locale) => `${date(v, locale)}, ${time(String(v).slice(11, 16))}`;

/** `{"from":"sabhyo","to":"sub_admin"}` → "from: sabhyo · to: sub_admin" (as in Settings → Activity log). */
function compact(detail) {
    if (!detail) return null;
    try {
        const obj = JSON.parse(detail);
        if (obj == null || typeof obj !== 'object') return String(obj);
        const parts = Object.entries(obj).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
        return parts.length ? parts.join(' · ') : null;
    } catch {
        return detail;
    }
}

/**
 * Members list ⋮ → Activity history (sub-admins and up): what this member did — each sign-in (with the device) and
 * every change they made — newest first, 30 at a time with "Show more". Loaded when it opens. Administrators can
 * clear this member's history here (asks first; the clearing is itself logged).
 * @param {{ member: { id: number, name: string }, open: boolean, onOpenChange: (v: boolean) => void }} props
 */
export default function MemberActivityDialog({ member, open, onOpenChange }) {
    const { t, locale } = useT();
    const [data, setData] = useState(null); // { rows, more, canClear }
    const [loading, startLoading] = useTransition();
    const [clearing, startClearing] = useTransition();

    const load = (before = null) =>
        startLoading(async () => {
            const res = await loadMemberActivity(member.id, before);
            if (res?.error) {
                toast.error(t(res.error));
                return onOpenChange(false);
            }
            setData((d) => (before && d ? { ...res, rows: [...d.rows, ...res.rows] } : res));
        });
    useEffect(() => {
        if (open) load();
        // Load once per opening.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [open]);

    const clear = () => {
        if (!window.confirm(t('activity.clearConfirm', { name: member.name }))) return;
        startClearing(async () => {
            const res = await clearAuditLog('', '', member.id);
            if (res?.error) return toast.error(t(res.error));
            toast.success(t('audit.cleared', { count: res.count }));
            setData((d) => ({ ...d, rows: [], more: false }));
        });
    };

    return (
        <Dialog
            open={open}
            onOpenChange={(v) => {
                onOpenChange(v);
                if (!v) setData(null);
            }}
        >
            <DialogContent focusPopup className="flex max-h-[92vh] flex-col bg-white sm:max-w-lg">
                <DialogHeader>
                    <DialogTitle className="text-base font-semibold text-primary">{t('activity.title')}</DialogTitle>
                    <DialogDescription className="text-xs text-ink-gray">{member.name}</DialogDescription>
                </DialogHeader>
                {data === null ? (
                    <div className="flex justify-center py-8">
                        <Loader2 className="size-5 animate-spin text-ink-gray" />
                    </div>
                ) : data.rows.length === 0 ? (
                    <p className="py-6 text-center text-sm text-ink-gray">{t('activity.empty')}</p>
                ) : (
                    <ul className="min-h-0 flex-1 divide-y divide-surface-border overflow-y-auto rounded-md border border-surface-border">
                        {data.rows.map((r) => {
                            const detail = compact(r.detail);
                            const login = r.action === 'auth.login';
                            return (
                                <li key={r.id} className="flex items-start gap-2.5 px-3 py-2 text-xs">
                                    {login ? (
                                        <LogIn className="mt-0.5 size-3.5 shrink-0 text-emerald-700" />
                                    ) : (
                                        <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-ink-gray/60" />
                                    )}
                                    <div className="min-w-0 flex-1">
                                        <p className="flex flex-wrap items-center gap-1.5">
                                            {login ? (
                                                <span className="font-medium text-primary">{t('activity.signedIn')}</span>
                                            ) : (
                                                <>
                                                    <Badge tone="navy">{t(`audit.entities.${r.entity}`)}</Badge>
                                                    <code className="text-ink">{r.action}</code>
                                                    {r.entity_id ? <span className="text-ink-gray tabular-nums">#{r.entity_id}</span> : null}
                                                </>
                                            )}
                                        </p>
                                        {detail && <p className="mt-0.5 break-words text-ink-gray">{detail}</p>}
                                    </div>
                                    <span className="shrink-0 whitespace-nowrap text-[11px] text-ink-gray tabular-nums">{when(r.at, locale)}</span>
                                </li>
                            );
                        })}
                    </ul>
                )}
                {data && (data.more || (data.canClear && data.rows.length > 0)) && (
                    <div className="flex items-center justify-between gap-2">
                        {data.more ? (
                            <button
                                type="button"
                                disabled={loading}
                                onClick={() => load(data.rows.at(-1)?.id)}
                                className="inline-flex h-8 items-center gap-1.5 rounded-md border border-surface-border px-3 text-xs font-medium text-primary hover:bg-accent disabled:opacity-60"
                            >
                                {loading && <Loader2 className="size-3.5 animate-spin" />} {t('activity.more')}
                            </button>
                        ) : (
                            <span />
                        )}
                        {data.canClear && data.rows.length > 0 && (
                            <button
                                type="button"
                                disabled={clearing}
                                onClick={clear}
                                className="inline-flex h-8 items-center gap-1 rounded-md border border-destructive/40 bg-white px-2.5 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
                            >
                                {clearing ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                                {t('activity.clear')}
                            </button>
                        )}
                    </div>
                )}
            </DialogContent>
        </Dialog>
    );
}
