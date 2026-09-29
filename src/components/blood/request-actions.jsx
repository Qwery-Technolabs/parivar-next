'use client';
import { CheckCircle2, RotateCcw, XCircle } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { setBloodRequestStatus } from '@/app/actions/blood';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

export default function RequestActions({ id, status }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();

    function set(next, close) {
        close();
        startTransition(async () => {
            const fd = new FormData();
            fd.set('id', String(id));
            fd.set('status', next);
            const res = await setBloodRequestStatus(null, fd);
            if (res?.ok) toast.success(t(res.message ?? 'common.saved'));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    }

    return (
        <div className={pending ? 'cursor-wait opacity-70' : ''}>
            <KebabMenu label={t('common.more')}>
                {(close) =>
                    status === 'open' ? (
                        <>
                            <MenuItem icon={CheckCircle2} onClick={() => set('fulfilled', close)} disabled={pending}>
                                {t('blood.markFulfilled')}
                            </MenuItem>
                            <MenuSeparator />
                            <MenuItem icon={XCircle} danger onClick={() => set('cancelled', close)} disabled={pending}>
                                {t('blood.markCancelled')}
                            </MenuItem>
                        </>
                    ) : (
                        <MenuItem icon={RotateCcw} onClick={() => set('open', close)} disabled={pending}>
                            {t('blood.reopen')}
                        </MenuItem>
                    )
                }
            </KebabMenu>
        </div>
    );
}
