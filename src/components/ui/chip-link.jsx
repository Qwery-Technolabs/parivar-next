'use client';
import { Check, Loader2 } from 'lucide-react';
import Link, { useLinkStatus } from 'next/link';

/** ✓ when chosen; a small spinner while the page it opens is loading (useLinkStatus). */
function Mark({ on }) {
    const { pending } = useLinkStatus();
    if (pending) return <Loader2 className="size-3.5 animate-spin" aria-hidden />;
    return on ? <Check className="size-3.5" aria-hidden /> : null;
}

/**
 * A filter chip that is a link (the filter lives in the URL): replaces the history entry, keeps the
 * scroll, and shows a mini loader on itself until the new view arrives.
 * @param {{ href: string, on: boolean, className: string, children: React.ReactNode }} props
 */
export default function ChipLink({ href, on, className, children }) {
    return (
        <Link href={href} replace scroll={false} aria-pressed={on} className={className}>
            <Mark on={on} />
            {children}
        </Link>
    );
}
