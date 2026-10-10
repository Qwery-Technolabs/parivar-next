'use client';
import { ExternalLink } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';

/**
 * Settings → About's two plain links: Privacy policy (its public page, new tab) and Open-source licences —
 * a link-styled toggle that adds the licences (`licences`, rendered on the server) below; hidden at first.
 */
export default function AboutLinks({ licences }) {
    const { t } = useT();
    const [open, setOpen] = useState(false);
    const link = 'inline-flex items-center gap-1.5 text-sm font-medium text-primary hover:underline';
    return (
        <>
            <div className="flex flex-wrap items-center gap-x-5 gap-y-2">
                <Link href="/privacy-policy" target="_blank" className={link}>
                    {t('about.privacyPolicy')} <ExternalLink className="size-3.5" />
                </Link>
                <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={link}>
                    {t('about.licenses')}
                </button>
            </div>
            {open && <div className="mt-4">{licences}</div>}
        </>
    );
}
