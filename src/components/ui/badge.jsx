// design-system.md §2 — ONE status map, imported everywhere, so two screens never disagree
// about what amber means. Every text colour here is ≥4.5:1 on its tint.

export const STATUS_TONE = {
    active: 'green',
    open: 'amber',
    fulfilled: 'green',
    cancelled: 'gray',
    closed: 'gray',
    draft: 'blue',
    inactive: 'gray',
    deceased: 'purple',
    admin: 'orange',
};

const TONES = {
    green: 'bg-emerald-50 text-emerald-700 ring-emerald-600/20',
    amber: 'bg-amber-50 text-amber-800 ring-amber-600/20',
    blue: 'bg-blue-50 text-blue-800 ring-blue-600/20',
    red: 'bg-rose-50 text-rose-700 ring-rose-600/20',
    purple: 'bg-purple-50 text-purple-800 ring-purple-600/20',
    gray: 'bg-surface-bggray/70 text-ink-gray ring-surface-border',
    navy: 'bg-brand-navy/10 text-brand-navy ring-brand-navy/20',
    // Orange is a state colour — never white-on-orange (2.22:1). Navy text on a light orange tint.
    orange: 'bg-orange-50 text-brand-navy ring-brand-orange/50',
    blood: 'bg-rose-50 text-rose-800 ring-rose-600/20',
};

/** @param {{ tone?: keyof typeof TONES, status?: string, children: React.ReactNode, className?: string }} props */
export default function Badge({ tone, status, children, className = '', ...rest }) {
    const t = TONES[tone ?? STATUS_TONE[status] ?? 'gray'];
    return (
        <span
            {...rest}
            className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${t} ${className}`}
        >
            {children}
        </span>
    );
}

export function BloodBadge({ group }) {
    if (!group) return <span className="text-ink-gray">—</span>;
    return (
        <Badge tone="blood" className="tabular-nums">
            {group}
        </Badge>
    );
}
