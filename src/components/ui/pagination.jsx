import Link from 'next/link';
import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { buildHref } from '@/lib/url';
import PerPageSelect from './per-page-select';

const btn = 'inline-flex size-8 items-center justify-center rounded-md border border-surface-border bg-white';

/** Disabled ends are <span>s: a disabled anchor is still focusable and announced as a link. */
function NavButton({ href, disabled, label, icon: Icon }) {
    return disabled ? (
        <span aria-hidden className={`${btn} text-surface-border`}>
            <Icon className="size-4" />
        </span>
    ) : (
        <Link href={href} scroll={false} aria-label={label} className={`${btn} text-primary hover:bg-accent`}>
            <Icon className="size-4" />
        </Link>
    );
}

/** DESIGN.md §6 — first/prev/next/last, every link rebuilt from the full param set. */
export default function Pagination({ pathname, searchParams, page, perPage, total, t, pageParam = 'page' }) {
    const pages = Math.max(1, Math.ceil(total / perPage));
    const from = total === 0 ? 0 : (page - 1) * perPage + 1;
    const to = Math.min(total, page * perPage);
    const href = (p) => buildHref(pathname, searchParams, { [pageParam]: p === 1 ? null : p });

    return (
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 text-xs text-ink-gray">
            <div className="flex items-center gap-3">
                <span className="tabular-nums">{t('common.showing', { from, to, total })}</span>
                <PerPageSelect value={perPage} label={t('common.rowsPerPage')} />
            </div>
            {pages > 1 && (
                <div className="flex items-center gap-1">
                    <NavButton href={href(1)} disabled={page <= 1} label={t('common.first')} icon={ChevronsLeft} />
                    <NavButton href={href(page - 1)} disabled={page <= 1} label={t('common.prev')} icon={ChevronLeft} />
                    <span className="px-2 tabular-nums">{t('common.pageOf', { page, pages })}</span>
                    <NavButton href={href(page + 1)} disabled={page >= pages} label={t('common.next')} icon={ChevronRight} />
                    <NavButton href={href(pages)} disabled={page >= pages} label={t('common.last')} icon={ChevronsRight} />
                </div>
            )}
        </div>
    );
}
