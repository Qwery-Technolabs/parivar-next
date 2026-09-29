// design-system.md §6 Table. Numbers are right-aligned tabular; cells wrap (never `truncate`
// in a table — it widens the column to the whole string and overflows the page).

export function TableShell({ children, className = '' }) {
    return (
        <div className={`overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm ${className}`}>
            <div className="overflow-x-auto">
                <table className="w-full text-sm">{children}</table>
            </div>
        </div>
    );
}

export function THead({ children }) {
    return (
        <thead>
            <tr className="border-b border-surface-border bg-surface-login text-left text-xs uppercase tracking-wide text-ink-gray">
                {children}
            </tr>
        </thead>
    );
}

export function Th({ children, className = '', numeric = false }) {
    return <th className={`px-3 py-2.5 font-semibold ${numeric ? 'text-right' : ''} ${className}`}>{children}</th>;
}

export function Tr({ children, className = '' }) {
    return (
        <tr className={`border-b border-surface-border last:border-0 hover:bg-accent/40 ${className}`}>{children}</tr>
    );
}

export function Td({ children, className = '', numeric = false }) {
    return (
        <td className={`px-3 py-2 align-middle ${numeric ? 'text-right tabular-nums' : 'break-words'} ${className}`}>
            {children ?? <span className="text-ink-gray">—</span>}
        </td>
    );
}

export function EmptyRow({ colSpan, children }) {
    return (
        <tr>
            <td colSpan={colSpan} className="px-3 py-8 text-center text-sm text-ink-gray">
                {children}
            </td>
        </tr>
    );
}
