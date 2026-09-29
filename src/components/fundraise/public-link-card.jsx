'use client';
import { Copy, ExternalLink, Globe, Lock, RefreshCw } from 'lucide-react';
import { useSyncExternalStore, useTransition } from 'react';
import { toast } from 'sonner';
import { regenerateToken, setPublic } from '@/app/actions/fundraise';
import { Card } from '@/components/shell/page-header';
import Switch from '@/components/ui/switch';
import { useT } from '@/lib/i18n/client';

const noop = () => () => {};

/** The public-link card, whole: its on/off switch sits in the card header (managers only). */
export default function PublicLinkCard({ campaignId, isPublic, token, canManage }) {
    const { t } = useT();
    const [pending, startTransition] = useTransition();
    // window.origin on the client, empty during SSR/hydration — no mismatch warning.
    const origin = useSyncExternalStore(noop, () => window.location.origin, () => '');
    const url = token ? `${origin}/p/${token}` : '';

    function run(fn) {
        startTransition(async () => {
            const res = await fn();
            if (res?.ok) toast.success(t(res.message));
            else toast.error(t(res?.error ?? 'common.error'));
        });
    }

    async function copy() {
        try {
            await navigator.clipboard.writeText(url);
            toast.success(t('fundraise.linkCopied'));
        } catch {
            toast.error(t('common.error'));
        }
    }

    return (
        <Card
            title={t('fundraise.publicLink')}
            actions={
                canManage && (
                    <Switch
                        checked={isPublic}
                        disabled={pending}
                        onChange={(v) => run(() => setPublic(campaignId, v))}
                        label={t('fundraise.publicSwitch')}
                    />
                )
            }
        >
        <div className={`space-y-3 ${pending ? 'cursor-wait opacity-70' : ''}`}>
            <div className="flex items-start gap-2">
                {isPublic ? (
                    <Globe className="mt-0.5 size-4 shrink-0 text-emerald-700" />
                ) : (
                    <Lock className="mt-0.5 size-4 shrink-0 text-ink-gray" />
                )}
                <p className="min-w-0 text-xs text-ink-gray">{isPublic ? t('fundraise.publicOn') : t('fundraise.publicOff')}</p>
            </div>
            {isPublic && token && (
                <>
                    <div className="flex min-w-0 items-center gap-2">
                        <input
                            readOnly
                            value={url}
                            onFocus={(e) => e.target.select()}
                            className="h-8 min-w-0 flex-1 rounded-md border border-surface-border bg-muted px-2 font-mono text-xs text-primary"
                        />
                        <button
                            type="button"
                            onClick={copy}
                            aria-label={t('common.copy')}
                            className="flex size-8 shrink-0 items-center justify-center rounded-md btn-secondary"
                        >
                            <Copy className="size-4" />
                        </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                        <a
                            href={`/p/${token}`}
                            target="_blank"
                            rel="noreferrer"
                            className="inline-flex h-8 items-center gap-1.5 rounded-md btn-secondary px-2.5 text-xs font-medium"
                        >
                            <ExternalLink className="size-3.5" /> {t('fundraise.openPublic')}
                        </a>
                        {canManage && (
                            <button
                                type="button"
                                disabled={pending}
                                onClick={() => window.confirm(t('fundraise.regenerateConfirm')) && run(() => regenerateToken(campaignId))}
                                className="inline-flex h-8 items-center gap-1.5 rounded-md btn-secondary px-2.5 text-xs font-medium"
                            >
                                <RefreshCw className="size-3.5" /> {t('fundraise.regenerate')}
                            </button>
                        )}
                    </div>
                </>
            )}
        </div>
        </Card>
    );
}
