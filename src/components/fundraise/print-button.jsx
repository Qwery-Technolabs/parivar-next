'use client';
import { Printer } from 'lucide-react';

/** Browser print → "Save as PDF" is the PDF path: it shapes Gujarati conjuncts correctly. */
export default function PrintButton({ label }) {
    return (
        <button
            type="button"
            onClick={() => window.print()}
            className="no-print inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
            <Printer className="size-4" /> {label}
        </button>
    );
}
