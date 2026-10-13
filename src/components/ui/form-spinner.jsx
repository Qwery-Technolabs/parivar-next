'use client';
import { Loader2 } from 'lucide-react';
import { useFormStatus } from 'react-dom';

/**
 * Inside a <form>: its icon turns into the mini loader while the form is submitting (e.g. opening a notification,
 * which marks it read and then goes to its page) — the form version of LinkIconSpinner.
 * @param {{ children: import('react').ReactNode, className?: string }} props
 */
export function FormIconSpinner({ children, className = 'size-4' }) {
    const { pending } = useFormStatus();
    return pending ? <Loader2 className={`shrink-0 animate-spin ${className}`} aria-hidden /> : children;
}
