'use client';
import { Loader2 } from 'lucide-react';
import { useLinkStatus } from 'next/link';

/**
 * A mini loader for the <Link> it sits in: spins while that link's page is loading (useLinkStatus), nothing
 * otherwise. Drop it inside any Link — tab bars, view switches, filter chips, month arrows.
 * @param {{ className?: string }} props
 */
export default function LinkSpinner({ className = 'size-3.5' }) {
    const { pending } = useLinkStatus();
    return pending ? <Loader2 className={`shrink-0 animate-spin ${className}`} aria-hidden /> : null;
}
