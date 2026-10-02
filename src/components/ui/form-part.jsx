/**
 * One part of a form card: a thin rule and a small-caps title, then its fields. The first part
 * in a card has no rule. `icon`: a lucide icon shown before the title. Used to group long forms (member, fundraise) into clear sections.
 */
export default function FormPart({ title, icon: Icon, children, className = '' }) {
    return (
        <div className={`border-t border-surface-border pt-3 first:border-t-0 first:pt-0 ${className}`}>
            {title && (
                <p className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-gray">
                    {Icon && <Icon className="size-3.5 shrink-0 text-brand-orange-strong" aria-hidden />}
                    {title}
                </p>
            )}
            {children}
        </div>
    );
}
