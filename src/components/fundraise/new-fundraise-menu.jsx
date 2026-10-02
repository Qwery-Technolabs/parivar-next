'use client';
import { ChevronDown, HandCoins, PiggyBank, Plus } from 'lucide-react';
import { MenuItem, Popover } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

/** "+ New ▾" on a group's Fundraises tab: start a Fundraise or a Mandal (savings circle) in this group. */
export default function NewFundraiseMenu({ groupId }) {
    const { t } = useT();
    return (
        <Popover
            trigger={({ open, toggle, id }) => (
                <button
                    id={id}
                    type="button"
                    onClick={toggle}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    className="btn-secondary inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium"
                >
                    <Plus className="size-4" />
                    {t('mandal.newMenu')}
                    <ChevronDown className={`size-4 transition-transform ${open ? 'rotate-180' : ''}`} />
                </button>
            )}
        >
            <MenuItem href={`/fundraise/new?group=${groupId}`} icon={HandCoins}>
                {t('mandal.kinds.fundraise')}
            </MenuItem>
            <MenuItem href={`/fundraise/new?group=${groupId}&kind=mandal`} icon={PiggyBank}>
                {t('mandal.kinds.mandal')}
            </MenuItem>
        </Popover>
    );
}
