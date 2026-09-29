'use client';
import { Copy, FileDown, Loader2, Share2 } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { toast } from 'sonner';
import { Popover } from '@/components/ui/popover';
import { useT } from '@/lib/i18n/client';

/** Clipboard API needs a secure context; plain-HTTP LAN access falls back to execCommand. */
async function copyText(text) {
    if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text);
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    ta.remove();
    if (!ok) throw new Error('copy failed');
}

/**
 * Copy the list as WhatsApp-ready text ("₹5,100  Ramesh Patel … ----- Total"), or open the
 * same list as a printable page for Save as PDF.
 * `menu`: phones — one Share icon opening the same three choices, for the toolbar row.
 * @param {{ campaignId: number, kind: 'income'|'expense'|'both', menu?: boolean }} props
 */
export default function LedgerExport({ campaignId, kind, menu = false }) {
    const { t } = useT();
    const [busy, setBusy] = useState(null);

    async function copy(k) {
        setBusy(k);
        try {
            const res = await fetch(`/api/fundraise/${campaignId}/ledger?kind=${k}`);
            if (!res.ok) throw new Error(String(res.status));
            await copyText(await res.text());
            toast.success(t('fundraise.ledger.copied'));
        } catch {
            toast.error(t('fundraise.ledger.copyFailed'));
        } finally {
            setBusy(null);
        }
    }

    const pdfHref = `/fundraise/${campaignId}/print?format=list&kind=${kind}`;
    if (menu) {
        const item = 'flex w-full items-center gap-2 px-3 py-2 text-left text-sm text-primary hover:bg-accent disabled:opacity-60';
        return (
            <Popover
                align="right"
                width="w-48"
                trigger={({ open, toggle, id }) => (
                    <button
                        id={id}
                        type="button"
                        onClick={toggle}
                        aria-haspopup="menu"
                        aria-expanded={open}
                        aria-label={t('common.share')}
                        title={t('common.share')}
                        className="btn-secondary inline-flex size-9 shrink-0 items-center justify-center rounded-full"
                    >
                        {busy ? <Loader2 className="size-4 animate-spin" /> : <Share2 className="size-4" />}
                    </button>
                )}
            >
                {(close) => (
                    <div role="menu">
                        <button role="menuitem" type="button" disabled={Boolean(busy)} onClick={() => (close(), copy(kind))} className={item}>
                            <Copy className="size-4 text-ink-gray" /> {t(kind === 'both' ? 'fundraise.ledger.copyAll' : 'fundraise.ledger.copy')}
                        </button>
                        {kind !== 'both' && (
                            <button role="menuitem" type="button" disabled={Boolean(busy)} onClick={() => (close(), copy('both'))} className={item}>
                                <Copy className="size-4 text-ink-gray" /> {t('fundraise.ledger.copyAll')}
                            </button>
                        )}
                        <Link role="menuitem" href={pdfHref} target="_blank" onClick={close} className={item}>
                            <FileDown className="size-4 text-ink-gray" /> {t('fundraise.ledger.pdf')}
                        </Link>
                    </div>
                )}
            </Popover>
        );
    }

    const btn = 'btn-secondary inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-xs font-medium disabled:opacity-60';
    return (
        <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => copy(kind)} disabled={Boolean(busy)} className={btn}>
                {busy === kind ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                {t(kind === 'both' ? 'fundraise.ledger.copyAll' : 'fundraise.ledger.copy')}
            </button>
            {kind !== 'both' && (
                <button type="button" onClick={() => copy('both')} disabled={Boolean(busy)} className={btn}>
                    {busy === 'both' ? <Loader2 className="size-3.5 animate-spin" /> : <Copy className="size-3.5" />}
                    {t('fundraise.ledger.copyAll')}
                </button>
            )}
            <Link href={pdfHref} target="_blank" className={btn}>
                <FileDown className="size-3.5" /> {t('fundraise.ledger.pdf')}
            </Link>
        </div>
    );
}
