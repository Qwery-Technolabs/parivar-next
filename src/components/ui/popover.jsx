'use client';
import { MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { useId, useState } from 'react';

/**
 * DESIGN.md §6 "Popup mechanics" — the ONE anchored popover idiom, used for the kebab,
 * filter panels and small dropdowns. relative parent / absolute panel, click-away layer
 * at z-10 and panel at z-20, Escape closes and returns focus, closes on URL change.
 *
 * @param {{ trigger: (p: { open: boolean, toggle: () => void, id: string }) => React.ReactNode, children: React.ReactNode | ((close: () => void) => React.ReactNode), align?: 'left'|'right', width?: string, role?: string }} props
 */
export function Popover({ trigger, children, align = 'right', width = 'w-52', role = 'menu' }) {
    const [open, setOpen] = useState(false);
    // Focus returns to the trigger by id: reading a ref inside `close`, which is handed to
    // children during render, is exactly what react-hooks/refs forbids.
    const triggerId = useId();
    const pathname = usePathname();
    const search = useSearchParams().toString();

    // Close when the URL changes — the requested thing has happened.
    const urlKey = `${pathname}?${search}`;
    const [seenUrl, setSeenUrl] = useState(urlKey);
    if (seenUrl !== urlKey) {
        setSeenUrl(urlKey);
        if (open) setOpen(false);
    }

    const close = () => {
        setOpen(false);
        document.getElementById(triggerId)?.focus();
    };

    return (
        <div className="relative" onKeyDown={(e) => e.key === 'Escape' && open && close()}>
            {trigger({ open, toggle: () => setOpen((v) => !v), id: triggerId })}
            {open && (
                <>
                    <button
                        type="button"
                        aria-hidden
                        tabIndex={-1}
                        onClick={() => setOpen(false)}
                        className="fixed inset-0 z-10 cursor-default"
                    />
                    <div
                        role={role}
                        className={`absolute ${align === 'right' ? 'right-0' : 'left-0'} z-20 mt-1 ${width} overflow-hidden rounded-md border border-surface-border bg-white py-1 shadow-lg`}
                    >
                        {typeof children === 'function' ? children(close) : children}
                    </div>
                </>
            )}
        </div>
    );
}

/** The kebab (⋮). Keep every kebab in the app identical. */
export function KebabMenu({ label, children }) {
    return (
        <Popover
            trigger={({ open, toggle, id }) => (
                <button
                    id={id}
                    type="button"
                    onClick={toggle}
                    aria-haspopup="menu"
                    aria-expanded={open}
                    aria-label={label}
                    className="flex size-9 items-center justify-center rounded-md text-ink-gray hover:bg-accent hover:text-primary"
                >
                    <MoreVertical className="size-4" />
                </button>
            )}
        >
            {children}
        </Popover>
    );
}

export function MenuItem({ icon: Icon, children, onClick, href, danger = false, disabled = false }) {
    const cls = `flex w-full items-center gap-2 px-3 py-2 text-left text-sm disabled:opacity-50 ${
        danger ? 'text-destructive hover:bg-destructive/10' : 'text-primary hover:bg-accent'
    }`;
    const icon = Icon ? <Icon className={`size-4 ${danger ? '' : 'text-ink-gray'}`} /> : null;
    if (href)
        return (
            <Link role="menuitem" href={href} className={cls}>
                {icon}
                {children}
            </Link>
        );
    return (
        <button role="menuitem" type="button" onClick={onClick} disabled={disabled} className={cls}>
            {icon}
            {children}
        </button>
    );
}

export function MenuSeparator() {
    return <div className="my-1 border-t border-surface-border" />;
}
