'use client';
import { Copy, MapPin, Navigation } from 'lucide-react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

/**
 * A member's address with three small actions: Copy (the address as written), Map (Google Maps search
 * for it) and Directions (Google Maps directions to it from where you are — the maps app asks for your
 * location). `query` is what Maps searches: the address, plus the city when the address does not name it.
 * @param {{ address: string, query: string }} props
 */
export default function AddressActions({ address, query }) {
    const { t } = useT();
    const q = encodeURIComponent(query);
    const copy = async () => {
        try {
            await navigator.clipboard.writeText(address);
            toast.success(t('members.addressCopied'));
        } catch {
            toast.error(t('common.error'));
        }
    };
    const btn = 'inline-flex h-8 items-center gap-1.5 rounded-md btn-secondary px-2.5 text-xs font-medium';
    return (
        <span className="block">
            <span className="whitespace-pre-line">{address}</span>
            <span className="mt-2 flex flex-wrap justify-end gap-1.5 sm:justify-start">
                <button type="button" onClick={copy} className={btn}>
                    <Copy className="size-3.5" /> {t('members.copyAddress')}
                </button>
                <a href={`https://www.google.com/maps/search/?api=1&query=${q}`} target="_blank" rel="noreferrer" className={btn}>
                    <MapPin className="size-3.5" /> {t('members.openMap')}
                </a>
                <a href={`https://www.google.com/maps/dir/?api=1&destination=${q}`} target="_blank" rel="noreferrer" className={btn}>
                    <Navigation className="size-3.5" /> {t('members.directions')}
                </a>
            </span>
        </span>
    );
}
