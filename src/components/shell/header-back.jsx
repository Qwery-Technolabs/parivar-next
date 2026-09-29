'use client';
import { ArrowLeft } from 'lucide-react';
import Link from 'next/link';
import { useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';

export const BACK_SLOT_ID = 'page-back-slot';

const noop = () => () => {};

/**
 * A page's "back" link, drawn in the top header (right of the sidebar's collapse arrow)
 * instead of taking a line above the title. Always goes straight to the parent page (out of
 * the group / fundraise) — never back through the tabs visited inside it.
 * @param {{ href: string, label: string }} props
 */
export default function HeaderBack({ href, label }) {
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
            aria-label={label}
            className="inline-flex h-8 min-w-0 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-white/85 hover:bg-brand-navy-soft hover:text-white"
        >
            <ArrowLeft className="size-4 shrink-0" />
            <span className="hidden truncate sm:inline">{label}</span>
        </Link>,
        slot,
    );
}
