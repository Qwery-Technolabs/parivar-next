'use client';

import { Toaster as Sonner } from 'sonner';
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, OctagonXIcon, Loader2Icon } from 'lucide-react';

// Light-only app (DESIGN.md §11), so no theme hook.
const Toaster = (props) => (
    <Sonner
        theme="light"
        className="toaster group"
        position="top-center"
        icons={{
            success: <CircleCheckIcon className="size-4 text-emerald-700" />,
            info: <InfoIcon className="size-4" />,
            warning: <TriangleAlertIcon className="size-4 text-amber-700" />,
            error: <OctagonXIcon className="size-4 text-destructive" />,
            loading: <Loader2Icon className="size-4 animate-spin" />,
        }}
        style={{
            '--normal-bg': 'var(--popover)',
            '--normal-text': 'var(--popover-foreground)',
            '--normal-border': 'var(--border)',
            '--border-radius': 'var(--radius)',
        }}
        {...props}
    />
);

export { Toaster };
