'use client';
import { Loader2, Trash2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { clearAuditLog } from '@/app/actions/audit';
import MemberPicker from '@/components/ui/member-picker';
import { useT } from '@/lib/i18n/client';

const dangerButton =
    'inline-flex h-9 shrink-0 items-center gap-1.5 rounded-md border border-destructive/40 bg-white px-3 text-xs font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60';

/**
 * Settings → Activity log → Danger zone (administrators): clear the whole log, or one member's history (pick them).
 * Each asks first; the server records the clearing as a new entry (actions/audit clearAuditLog).
 */
export default function AuditDangerZone() {
    const { t } = useT();
    const router = useRouter();
    const [member, setMember] = useState(null);
    const [pending, startTransition] = useTransition();
    const [which, setWhich] = useState(null); // 'all' | 'member' — the spinner's button
    const [pickerKey, setPickerKey] = useState(0); // a new picker (empty) after a clearing

    const run = (kind) => {
        if (!window.confirm(t(kind === 'all' ? 'audit.danger.clearAllConfirm' : 'audit.danger.clearMemberConfirm'))) return;
        setWhich(kind);
        startTransition(async () => {
            const res = await clearAuditLog('', '', kind === 'member' ? member : null);
            if (res?.error) toast.error(t(res.error));
            else {
                toast.success(t('audit.cleared', { count: res.count }));
                setMember(null);
                setPickerKey((k) => k + 1);
                router.refresh();
            }
        });
    };

    return (
        <section className="mt-6 rounded-lg border border-destructive/30 bg-white">
            <h2 className="rounded-t-lg border-b border-destructive/20 bg-destructive/5 px-3.5 py-2.5 text-sm font-semibold text-destructive">
                {t('audit.danger.title')}
            </h2>
            <div className="space-y-4 p-3.5">
                <p className="text-xs text-ink-gray">{t('audit.danger.hint')}</p>
                <div>
                    <span className="mb-1 block text-xs font-medium text-ink-gray">{t('audit.danger.clearMember')}</span>
                    <div className="flex flex-wrap items-center gap-2">
                        <div key={pickerKey} className="min-w-56 flex-1">
                            <MemberPicker onPick={(opt) => setMember(opt ? Number(opt.value) || null : null)} placeholder={t('audit.danger.pickMember')} />
                        </div>
                        <button type="button" disabled={!member || pending} onClick={() => run('member')} className={dangerButton}>
                            {pending && which === 'member' ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                            {t('audit.danger.clear')}
                        </button>
                    </div>
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-surface-border pt-3">
                    <span className="text-sm font-medium text-primary">{t('audit.danger.clearAll')}</span>
                    <button type="button" disabled={pending} onClick={() => run('all')} className={dangerButton}>
                        {pending && which === 'all' ? <Loader2 className="size-3.5 animate-spin" /> : <Trash2 className="size-3.5" />}
                        {t('audit.danger.clearAll')}
                    </button>
                </div>
            </div>
        </section>
    );
}
