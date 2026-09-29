'use client';
import { MoreVertical } from 'lucide-react';
import Link from 'next/link';
import { usePathname, useSearchParams } from 'next/navigation';
import { isValidElement, useEffect, useId, useRef, useState } from 'react';
import { createPortal } from 'react-dom';

const GAP = 4;
const EDGE = 8;
const MAX_H = 512; // 32rem

/**
 * Where to put the panel: below the trigger, or above it when there is clearly more room
 * above. Right-aligned panels hang from the trigger's right edge (a toolbar or row-end kebab),
 * left-aligned from its left. The height is capped by the room available on that side.
 */
function place(rect, align) {
    const below = window.innerHeight - rect.bottom - EDGE;
    const above = rect.top - EDGE;
    const up = below < 220 && above > below;
    const room = up ? above : below;
    return {
        position: 'fixed',
        ...(up ? { bottom: window.innerHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
        ...(align === 'right' ? { right: Math.max(EDGE, window.innerWidth - rect.right) } : { left: Math.max(EDGE, rect.left) }),
        maxHeight: Math.max(120, Math.min(MAX_H, room - GAP)),
    };
}

/**
 * DESIGN.md §6 "Popup mechanics" — the ONE anchored popover idiom, used for the kebab,
 * filter panels and small dropdowns. Escape closes and returns focus; it closes on URL
 * change, on page scroll and on resize.
 *
 * The panel is PORTALLED to <body> with fixed coordinates taken from the trigger. §6 prefers
 * a plain relative/absolute pair, but a kebab inside a table sits in an overflow-x-auto
 * scroll box, and a scroll box clips absolutely positioned children — the menu came out as a
 * tiny scrolling sliver. Fixed + portal escapes every such container.
 *
 * @param {{ trigger: (p: { open: boolean, toggle: () => void, id: string }) => React.ReactNode, children: React.ReactNode | ((close: () => void) => React.ReactNode), align?: 'left'|'right', width?: string, role?: string }} props
 */
export function Popover({ trigger, children, align = 'right', width = 'w-52', role = 'menu' }) {
    const [pos, setPos] = useState(null); // null = closed
    const open = pos !== null;
    const panelRef = useRef(null);
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
        if (open) setPos(null);
    }

    // A fixed panel would drift away from its trigger when the page scrolls, so it closes
    // instead — except when the scroll is inside the panel itself (a long filter list).
    useEffect(() => {
        if (!open) return undefined;
        const onScroll = (e) => {
            if (!panelRef.current?.contains(e.target)) setPos(null);
        };
        const onResize = () => setPos(null);
        window.addEventListener('scroll', onScroll, true);
        window.addEventListener('resize', onResize);
        return () => {
            window.removeEventListener('scroll', onScroll, true);
            window.removeEventListener('resize', onResize);
        };
    }, [open]);

    const toggle = () => {
        if (open) return setPos(null);
        const el = document.getElementById(triggerId);
        if (el) setPos(place(el.getBoundingClientRect(), align));
    };
    const close = () => {
        setPos(null);
        document.getElementById(triggerId)?.focus();
    };

    return (
        // React events bubble through portals, so Escape inside the panel still reaches here.
        <div className="relative" onKeyDown={(e) => e.key === 'Escape' && open && close()}>
            {trigger({ open, toggle, id: triggerId })}
            {open &&
                createPortal(
                    <>
                        <button
                            type="button"
                            aria-hidden
                            tabIndex={-1}
                            onClick={() => setPos(null)}
                            className="fixed inset-0 z-40 cursor-default"
                        />
                        <div
                            ref={panelRef}
                            role={role}
                            style={pos}
                            // overscroll-contain: scrolling a long panel does not scroll the page behind.
                            className={`z-41 ${width} max-w-[calc(100vw-1rem)] overflow-y-auto overscroll-contain rounded-md border border-surface-border bg-white py-1 shadow-lg`}
                        >
                            {typeof children === 'function' ? children(close) : children}
                        </div>
                    </>,
                    document.body,
                )}
        </div>
    );
}

/** The kebab (⋮). Keep every kebab in the app identical. */
export function KebabMenu({ label, children, align = 'right' }) {
    return (
        <Popover
            align={align}
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
    // A component, or an already-rendered element (what a server page can pass).
    const icon = isValidElement(Icon) ? (
        <span className={`flex size-4 items-center justify-center [&>svg]:size-4 ${danger ? '' : 'text-ink-gray'}`}>{Icon}</span>
    ) : Icon ? (
        <Icon className={`size-4 ${danger ? '' : 'text-ink-gray'}`} />
    ) : null;
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
