'use client';
import { useLayoutEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

/**
 * The drop-down list of every picker (Combobox, PickOrType, TagSelect …): drawn on the page's top
 * layer (portalled to <body>, position fixed) under its input — or above it when there is clearly
 * more room above — so no card (overflow-hidden), table or dialog scroll box can ever clip it.
 * Follows the input on any scroll / resize. Positioned straight on the element (no state, no
 * re-render). `data-floating-list` lets FormDialog treat a press on it as inside the dialog;
 * mousedown is cancelled so the input keeps focus and the list stays open while picking.
 * Render it only while open. Any new picker list must use this — never `absolute` under the input.
 * @param {{ anchorRef: React.RefObject<HTMLElement>, id?: string, className?: string, children: React.ReactNode } & React.HTMLAttributes<HTMLUListElement>} props
 */
export default function FloatingList({ anchorRef, className = '', children, ...rest }) {
    const ref = useRef(null);
    useLayoutEffect(() => {
        const place = () => {
            const anchor = anchorRef.current;
            const el = ref.current;
            if (!anchor || !el) return;
            const r = anchor.getBoundingClientRect();
            const below = window.innerHeight - r.bottom - 8;
            const above = r.top - 8;
            const up = below < 200 && above > below;
            el.style.left = `${r.left}px`;
            el.style.width = `${r.width}px`;
            el.style.top = up ? '' : `${r.bottom + 4}px`;
            el.style.bottom = up ? `${window.innerHeight - r.top + 4}px` : '';
            el.style.maxHeight = `${Math.max(120, Math.min(256, (up ? above : below) - 4))}px`;
        };
        place();
        window.addEventListener('scroll', place, true);
        window.addEventListener('resize', place);
        return () => {
            window.removeEventListener('scroll', place, true);
            window.removeEventListener('resize', place);
        };
    }, [anchorRef]);

    return createPortal(
        <ul
            ref={ref}
            data-floating-list=""
            onMouseDown={(e) => e.preventDefault()}
            style={{ position: 'fixed' }}
            className={`z-[70] overflow-y-auto rounded-md border border-surface-border bg-white py-1 shadow-lg ${className}`}
            {...rest}
        >
            {children}
        </ul>,
        document.body,
    );
}
