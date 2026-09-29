import { cookies } from 'next/headers';
import Link from 'next/link';
import Badge from '@/components/ui/badge';
import Pagination from '@/components/ui/pagination';
import FilterBar from '@/components/ui/filter-bar';
import ClearLogButton from './clear-log-button';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { query } from '@/lib/db';
import { localized } from '@/lib/i18n/config';
import { normalizePage, normalizePerPage, PER_PAGE_COOKIE } from '@/lib/tablePrefs';
import { sp1 } from '@/lib/url';

const ENTITIES = ['user', 'group', 'fundraise', 'blood', 'event', 'caste', 'settings'];

/** `{"from":"sabhyo","to":"sub_admin"}` → "from: sabhyo · to: sub_admin". */
function compact(detail) {
    if (detail == null) return null;
    const obj = typeof detail === 'string' ? safeParse(detail) : detail;
    if (obj == null || typeof obj !== 'object') return String(detail);
    const parts = Object.entries(obj).map(([k, v]) => `${k}: ${typeof v === 'object' ? JSON.stringify(v) : v}`);
    return parts.length ? parts.join(' · ') : null;
}

function safeParse(s) {
    try {
        return JSON.parse(s);
    } catch {
        return s;
    }
}

/**
 * The activity log: who changed what, newest first, with search, a type filter and pages.
 * Shown as Settings → Activity log (?section=audit), for sub-admins and up — the settings page
 * checks access; filters and pages keep ?section=audit in the URL.
 * canClear: administrators get a button that deletes the entries the current filter shows.
 * @param {{ sp: Record<string, string|string[]>, t: (k: string, v?: object) => string, locale: string, canClear?: boolean }} props
 */
export default async function AuditLog({ sp, t, locale, canClear = false }) {
    const pathname = '/settings';

    const entity = ENTITIES.includes(sp1(sp.entity)) ? sp1(sp.entity) : '';
    const page = normalizePage(sp.page);
    const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);
    const q = String(sp1(sp.q) ?? '').trim().slice(0, 100);
    // Filter by member: who did it (a.actor_id).
    const actorId = Number.parseInt(sp1(sp.actor), 10);
    const actor = Number.isInteger(actorId) && actorId > 0 ? actorId : null;
    const conds = [];
    const params = {};
    if (actor) {
        conds.push('a.actor_id = :actor');
        params.actor = actor;
    }
    if (entity) {
        conds.push('a.entity = :entity');
        params.entity = entity;
    }
    if (q) {
        conds.push('(a.action LIKE :q OR u.full_name LIKE :q OR u.full_name_local LIKE :q)');
        params.q = `%${q}%`;
    }
    const where = conds.length ? conds.join(' AND ') : '1=1';

    const [[{ total }], rows, actors] = await Promise.all([
        query(`SELECT COUNT(*) AS total FROM admin_audit_log a LEFT JOIN users_list u ON u.id = a.actor_id WHERE ${where}`, params),
        // perPage/offset are server-clamped integers, inlined on purpose (DESIGN.md §9).
        query(
            `SELECT a.id, a.action, a.entity, a.entity_id, a.detail, a.created_at,
                    u.id AS actor_id, u.full_name, u.full_name_local
               FROM admin_audit_log a LEFT JOIN users_list u ON u.id = a.actor_id
              WHERE ${where}
              ORDER BY a.id DESC
              LIMIT ${perPage} OFFSET ${(page - 1) * perPage}`,
            params,
        ),
        // The member filter offers only people who appear in the log.
        query(
            `SELECT DISTINCT u.id, u.full_name, u.full_name_local
               FROM admin_audit_log a JOIN users_list u ON u.id = a.actor_id
              ORDER BY u.full_name LIMIT 500`,
        ),
    ]);

    const entityHref = (row) => {
        if (!row.entity_id) return null;
        if (row.entity === 'user') return `/members/${row.entity_id}`;
        if (row.entity === 'group') return `/groups/${row.entity_id}`;
        if (row.entity === 'fundraise') return `/fundraise/${row.entity_id}`;
        return null;
    };

    return (
        <div>
            <FilterBar
                search={{ placeholder: t('audit.searchPlaceholder') }}
                filters={[
                    {
                        param: 'entity',
                        label: t('audit.entity'),
                        type: 'select',
                        allLabel: t('common.all'),
                        options: ENTITIES.map((e) => ({ value: e, label: t(`audit.entities.${e}`) })),
                    },
                    {
                        param: 'actor',
                        label: t('audit.member'),
                        type: 'select',
                        allLabel: t('common.all'),
                        options: actors.map((a) => ({ value: String(a.id), label: localized(a, 'full_name', locale) })),
                    },
                ]}
                left={<span className="text-xs text-ink-gray tabular-nums">{t('audit.count', { count: total })}</span>}
            />
            <TableShell>
                <THead>
                    <Th>{t('audit.when')}</Th>
                    <Th>{t('audit.actor')}</Th>
                    <Th>{t('audit.action')}</Th>
                    <Th>{t('audit.detail')}</Th>
                </THead>
                <tbody>
                    {rows.length === 0 && <EmptyRow colSpan={4}>{t('audit.empty')}</EmptyRow>}
                    {rows.map((r) => {
                        const href = entityHref(r);
                        return (
                            <Tr key={r.id}>
                                <Td className="whitespace-nowrap text-xs text-ink-gray tabular-nums">{String(r.created_at).slice(0, 16)}</Td>
                                <Td className="max-w-48">
                                    {r.actor_id ? (
                                        <Link href={`/members/${r.actor_id}`} className="font-medium text-primary hover:underline">
                                            {localized(r, 'full_name', locale)}
                                        </Link>
                                    ) : null}
                                </Td>
                                <Td>
                                    <div className="flex flex-wrap items-center gap-1.5">
                                        <Badge tone="navy">{t(`audit.entities.${r.entity}`)}</Badge>
                                        <code className="text-xs text-ink">{r.action}</code>
                                        {href ? (
                                            <Link href={href} className="text-xs font-medium text-primary hover:underline tabular-nums">
                                                #{r.entity_id}
                                            </Link>
                                        ) : r.entity_id ? (
                                            <span className="text-xs text-ink-gray tabular-nums">#{r.entity_id}</span>
                                        ) : null}
                                    </div>
                                </Td>
                                <Td className="max-w-md text-xs text-ink-gray">{compact(r.detail)}</Td>
                            </Tr>
                        );
                    })}
                </tbody>
            </TableShell>
            <Pagination pathname={pathname} searchParams={sp} page={page} perPage={perPage} total={total} t={t} />
            {/* Out of the way, below the table: deleting log entries is not an everyday action. */}
            {canClear && total > 0 && (
                <div className="mt-6 flex justify-end border-t border-surface-border pt-3">
                    <ClearLogButton entity={entity} q={q} actor={actor} count={total} />
                </div>
            )}
        </div>
    );
}
