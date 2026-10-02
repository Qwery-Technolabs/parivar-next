/**
 * One part of a form card: a thin rule and a small-caps title, then its fields. The first part
 * in a card has no rule. Used to group long forms (member, fundraise) into clear sections.
 */
export default function FormPart({ title, children, className = '' }) {
    return (
        <div className={`border-t border-surface-border pt-3 first:border-t-0 first:pt-0 ${className}`}>
            {title && <p className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-gray">{title}</p>}
            {children}
        </div>
    );
}
