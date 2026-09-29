'use client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export const BACK_SLOT_ID = 'page-back-slot';

const noop = () => () => {};

/**
 * A page's "back" link, drawn in the top header (right of the sidebar's collapse arrow)
 * instead of taking a line above the title. Desktop: a link to the parent page. Phone: the
 * browser's history back, falling back to the link when there is no history.
 * @param {{ href: string, label: string }} props
 */
export default function HeaderBack({ href, label }) {
    const router = useRouter();
    // The slot lives in the app shell; on the server (and before hydration) there is none.
    const slot = useSyncExternalStore(
        noop,
        () => document.getElementById(BACK_SLOT_ID),
        () => null,
    );
    if (!slot) return null;

    return createPortal(
        <Link
            href={href}
            onClick={(e) => {
                const phone = window.matchMedia('(max-width: 1023px)').matches;
                if (phone && window.history.length > 1) {
                    e.preventDefault();
                    router.back();
                }
            }}
            aria-label={label}
            className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-white/85 hover:bg-brand-navy-soft hover:text-white"
        >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="hidden truncate sm:inline">{label}</span>
        </Link>,
        slot,
    );
}
