// design-system.md §6 — a Field wrapper plus class functions. The wrapper never renders the
// control, because it cannot know whether that is an input, a select or three boxes.

/**
 * @param {{ label?: React.ReactNode, error?: string|null, hint?: React.ReactNode, required?: boolean, className?: string, children: React.ReactNode }} props
 */
export function Field({ label, error, hint, required = false, className = '', children }) {
    return (
        <label className={`block min-w-0 ${className}`}>
            {label && (
                <span className="mb-1 block text-xs font-medium text-ink-gray">
                    {label}
                    {required && <span className="ml-0.5 text-destructive">*</span>}
                </span>
            )}
            {children}
            {/* Error REPLACES the hint — two lines under one control is noise. */}
            {error ? (
                <span className="mt-1 block text-xs font-medium text-destructive">{error}</span>
            ) : hint ? (
                <span className="mt-1 block text-xs text-ink-gray">{hint}</span>
            ) : null}
        </label>
    );
}

const base = 'rounded-md border bg-white text-sm text-primary outline-none disabled:bg-muted disabled:text-ink-gray';
const ok = 'border-surface-border focus:border-ring focus:ring-2 focus:ring-ring/30';
const bad = 'border-destructive focus:border-destructive focus:ring-2 focus:ring-destructive/30';

/** The one input class string. Error state is a BORDER + RING, never a fill. */
export function textInput(hasError = false, size = 'h-9') {
    return `${size} px-3 ${base} ${hasError ? bad : ok}`;
}

export function selectInput(hasError = false, size = 'h-9') {
    return `${size} pl-2.5 pr-8 ${base} ${hasError ? bad : ok}`;
}

export function textArea(hasError = false) {
    return `min-h-20 px-3 py-2 ${base} ${hasError ? bad : ok}`;
}

/**
 * An English field and its local-language (Gujarati) twin that fills itself from it: both sit in one lightly
 * shaded box, so it is clear which translation belongs to which field. Used by every English ↔ local pair.
 */
export const translationPair = 'rounded-lg bg-surface-bggray/60 p-2.5 ring-1 ring-inset ring-surface-border';
