import Link from 'next/link';
import HeaderBack from './header-back';
import { cn } from '@/lib/utils';

/**
 * Title row: title + subtitle left, actions right; wraps on a phone.
 * `menu` (a PageMenu) — the page's actions as a kebab — sits at the right end of the row,
 * where action buttons used to be.
 */
export default function PageHeader({ title, subtitle, back, actions, menu }) {
    return (
        <div className="mb-4 flex items-start justify-between gap-3">
            <div className="min-w-0">
                {/* Drawn in the top header, not here — saves a line on every page. */}
                {back && <HeaderBack href={back.href} label={back.label} />}
                <h1 className="text-lg font-semibold text-primary break-words">{title}</h1>
                {subtitle && <p className="mt-0.5 text-xs text-ink-gray">{subtitle}</p>}
            </div>
            {(actions || menu) && (
                <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
                    {actions}
                    {menu}
                </div>
            )}
        </div>
    );
}

/** design-system.md §3 caption idiom + §4 stat-card number. */
export function StatCard({ label, value, href, icon: Icon, tone = 'text-primary' }) {
    const body = (
        <div className="flex items-start justify-between gap-3 rounded-lg border border-surface-border bg-white p-3.5 shadow-sm">
            <div className="min-w-0">
                <p className="text-[11px] uppercase tracking-wide text-ink-gray">{label}</p>
                <p className={`mt-1 text-2xl font-semibold tabular-nums ${tone}`}>{value}</p>
            </div>
            {Icon && <Icon className="size-5 shrink-0 text-ink-gray" />}
        </div>
    );
    return href ? (
        <Link href={href} className="block rounded-lg hover:ring-2 hover:ring-ring/30">
            {body}
        </Link>
    ) : (
        body
    );
}

/** `tone="danger"`: red border and a solid red header (Danger zone cards). */
export function Card({ title, actions, children, className = '', bodyClass = 'p-3.5', tone = null }) {
    const danger = tone === 'danger';
    return (
        <section className={`min-w-0 rounded-lg border bg-white shadow-sm ${danger ? 'border-destructive/50' : 'border-surface-border'} ${className}`}>
            {(title || actions) && (
                <div
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-t-lg border-b px-3.5 py-2.5 ${
                        danger ? 'border-destructive bg-destructive text-white' : 'border-surface-border bg-card-head'
                    }`}
                >
                    <h2 className={`text-sm font-semibold ${danger ? 'text-white' : 'text-primary'}`}>{title}</h2>
                    {actions}
                </div>
            )}
            <div className={bodyClass}>{children}</div>
        </section>
    );
}

export function LinkButton({ href, icon: Icon, children, variant = 'primary', className = '' }) {
    const v = {
        primary: 'bg-primary text-primary-foreground hover:bg-primary/90',
        secondary: 'btn-secondary',
        outline: 'border border-surface-border bg-white text-primary hover:bg-accent',
    }[variant];
    return (
        <Link
            href={href}
            // cn(): a caller's size override (h-8 px-3 text-xs) must replace the defaults, not race them.
            className={cn('inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-md px-4 text-sm font-medium', v, className)}
        >
            {Icon && <Icon className="size-4" />}
            {children}
        </Link>
    );
}
