'use client';
import { Loader2, Trash2 } from 'lucide-react';
import { useTransition } from 'react';
import { toast } from 'sonner';
import { deleteCampaign } from '@/app/actions/fundraise';
import { useT } from '@/lib/i18n/client';

export default function DeleteCampaignButton({ campaignId }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    return (
        <button
            type="button"
            disabled={pending}
            onClick={() => {
                if (!window.confirm(t('fundraise.deleteCampaignConfirm'))) return;
                startTransition(async () => {
                    const res = await deleteCampaign(campaignId); // redirects on success
                    if (res?.error) toast.error(t(res.error));
                });
            }}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-md border border-destructive/40 bg-white px-4 text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-60"
        >
            {pending ? <Loader2 className="size-4 animate-spin" /> : <Trash2 className="size-4" />}
            {t('fundraise.deleteCampaign')}
        </button>
    );
}
