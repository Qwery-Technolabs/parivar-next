'use client';
import { Copy } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

/**
 * A member's address as a link (underlined, blue) that opens it in Google Maps, with a plain grey copy
 * icon beside it. `query` is what Maps searches: the address, plus the city when the address does not name it.
 * @param {{ address: string, query: string }} props
 */
export default function AddressActions({ address, query }) {
    const { t } = useT();
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(address);
            toast.success(t('members.addressCopied'));
        } catch {
            toast.error(t('common.error'));
        }
    };
    return (
        <span className="inline-flex items-start gap-1.5">
            <a
                href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(query)}`}
                target="_blank"
                rel="noreferrer"
                title={t('members.openMap')}
                className="whitespace-pre-line text-blue-700 underline decoration-blue-300 underline-offset-2 hover:decoration-blue-700"
            >
                {address}
            </a>
            <button
                type="button"
                onClick={copy}
                aria-label={t('members.copyAddress')}
                title={t('members.copyAddress')}
                className="mt-0.5 shrink-0 text-ink-gray hover:text-primary"
            >
                <Copy className="size-4" />
            </button>
        </span>
    );
}
