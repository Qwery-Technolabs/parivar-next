'use client';
import { User, UserMinus } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { removeMandalMember } from '@/app/actions/mandal';
import { KebabMenu, MenuItem, MenuSeparator } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

/**
 * A Mandal member's ⋮ (About → Members): View profile, and — for those who run it, when the member
 * can be removed here (added by phone, not "everyone in the group") — Remove, last, red, asks first.
 */
export default function MandalMemberMenu({ campaignId, member, canRemove = false }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    const remove = (close) => {
        close();
        if (!window.confirm(t('mandal.removeConfirm', { name: member.name }))) return;
        startTransition(async () => {
            const res = await removeMandalMember(campaignId, member.id);
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    };
    return (
        <div className={pending ? 'cursor-wait opacity-70' : ''}>
            <KebabMenu label={t('common.more')}>
                {(close) => (
                    <>
                        <MenuItem icon={User} href={`/members/${member.id}`}>
                            {t('mandal.viewProfile')}
                        </MenuItem>
                        {canRemove && (
                            <>
                                <MenuSeparator />
                                <MenuItem icon={UserMinus} danger disabled={pending} onClick={() => remove(close)}>
                                    {t('mandal.remove')}
                                </MenuItem>
                            </>
                        )}
                    </>
                )}
            </KebabMenu>
        </div>
    );
}
