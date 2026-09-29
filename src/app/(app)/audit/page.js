import { cookies } from 'next/headers';
import EntityFilter from '@/components/audit/entity-filter';
import Link from 'next/link';
import PageHeader from '@/components/shell/page-header';
import Badge from '@/components/ui/badge';
import Pagination from '@/components/ui/pagination';
import { EmptyRow, TableShell, Td, Th, THead, Tr } from '@/components/ui/table';
import { requireRole } from '@/lib/auth';
import { query } from '@/lib/db';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { normalizePage, normalizePerPage, PER_PAGE_COOKIE } from '@/lib/tablePrefs';
import { sp1 } from '@/lib/url';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('audit.title') };
}

const ENTITIES = ['user', 'group', 'fundraise', 'blood', 'event', 'caste', 'settings'];

/** `{"from":"sabhyo","to":"sarpanch"}` → "from: sabhyo · to: sarpanch". */
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

export default async function AuditPage({ searchParams }) {
    await requireRole('sub_admin');
    const sp = await searchParams;
    const { t, locale } = await getT();
    const pathname = '/audit';

    const entity = ENTITIES.includes(sp1(sp.entity)) ? sp1(sp.entity) : '';
    const page = normalizePage(sp.page);
    const perPage = normalizePerPage((await cookies()).get(PER_PAGE_COOKIE)?.value);
    const where = entity ? 'a.entity = :entity' : '1=1';
    const params = entity ? { entity } : {};

    const [[{ total }], rows] = await Promise.all([
        query(`SELECT COUNT(*) AS total FROM admin_audit_log a WHERE ${where}`, params),
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
            <PageHeader title={t('audit.title')} />
            <EntityFilter
                value={entity}
                label={t('common.filters')}
                allLabel={t('common.all')}
                options={ENTITIES.map((e) => ({ value: e, label: t(`audit.entities.${e}`) }))}
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
        </div>
    );
}
