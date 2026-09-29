'use client';
import { Loader2 } from 'lucide-react';
import { isValidElement } from 'react';
import { useFormStatus } from 'react-dom';

const VARIANTS = {
    primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
    outline: 'border border-surface-border bg-white text-primary hover:bg-accent',
    danger: 'bg-destructive text-white hover:bg-destructive/90',
};

/**
 * DESIGN.md §6 loaders — the spinner REPLACES the icon so the width does not jump.
 * `icon` is a component from client callers, or an already-rendered element (<Save className="size-4" />)
 * from server components, where a component reference cannot cross into this client component.
 * @param {{ icon?: React.ComponentType<{className?: string}> | React.ReactElement, children: React.ReactNode, pendingText?: string, variant?: keyof typeof VARIANTS, size?: string, className?: string, pending?: boolean }} props
 */
export default function SubmitButton({
    icon: Icon,
    children,
    pendingText,
    variant = 'primary',
    size = 'h-9',
    className = '',
    pending: forced,
}) {
    const { pending: formPending } = useFormStatus();
    const busy = forced ?? formPending;
    return (
        <button
            type="submit"
            disabled={busy}
            className={`inline-flex ${size} shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
        >
            {busy ? <Loader2 className="size-4 animate-spin" /> : isValidElement(Icon) ? Icon : Icon ? <Icon className="size-4" /> : null}
            {busy && pendingText ? pendingText : children}
        </button>
    );
}
