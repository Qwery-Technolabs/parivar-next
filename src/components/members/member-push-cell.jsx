'use client';
import { BellOff, BellRing, Loader2 } from 'lucide-react';
import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { remindPush } from '@/app/actions/push';
import PushDevicesDialog from '@/components/members/push-devices-dialog';
import ConfirmDialog from '@/components/ui/confirm-dialog';
import { useT } from '@/lib/i18n/client';

/**
 * Members list, the row-end square for notifications (sub-admins and up):
 *  - on (has a device): light-green bell → the member's Notification devices pop-up (devices · send), as on the profile;
 *  - off: red slashed bell → asks (the app's ConfirmDialog), then reminds them — the next time they open the app, the "Turn on notifications?"
 *    pop-up shows again (actions/push remindPush).
 * @param {{ member: { id: number, name: string }, on: boolean }} props
 */
export default function MemberPushCell({ member, on }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    const [asking, setAsking] = useState(false);
    const square = 'inline-flex size-8 items-center justify-center rounded-md';

    if (on)
        return (
            <PushDevicesDialog
                userId={member.id}
                canSend
                trigger={(open) => (
                    <button
                        type="button"
                        onClick={open}
                        title={t('push.devices.on')}
                        aria-label={t('push.devices.on')}
                        className={`${square} bg-emerald-50 text-emerald-700 hover:bg-emerald-100`}
                    >
                        <BellRing className="size-3.5" />
                    </button>
                )}
            />
        );

    const send = () =>
        startTransition(async () => {
            const res = await remindPush(member.id);
            setAsking(false);
            if (res?.ok) toast.success(t(res.message, { name: member.name }));
            else toast.error(t(res?.error ?? 'common.error'));
        });

    return (
        <>
            <button
                type="button"
                disabled={pending}
                title={t('push.remind.button')}
                aria-label={t('push.remind.button')}
                onClick={() => setAsking(true)}
                className={`${square} bg-rose-50 text-rose-600 hover:bg-rose-100 disabled:opacity-60`}
            >
                {pending ? <Loader2 className="size-3.5 animate-spin" /> : <BellOff className="size-3.5" />}
            </button>
            <ConfirmDialog
                open={asking}
                onOpenChange={setAsking}
                icon={BellRing}
                title={t('push.remind.title')}
                description={t('push.remind.confirm', { name: member.name })}
                confirmLabel={t('push.remind.send')}
                pending={pending}
                onConfirm={send}
            />
        </>
    );
}
