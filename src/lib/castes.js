import 'server-only';
import { query } from './db';
import { memo } from './memo';

/**
 * All castes with their sub-castes and member counts, as a two-level tree.
 * @param {{ activeOnly?: boolean }} [opts] activeOnly for pickers; the admin page shows all
 */
export async function listCastes({ activeOnly = false } = {}) {
    const rows = await query(
        `SELECT c.id, c.parent_id, c.name, c.name_local, c.sort_order, c.status,
                COALESCE(n.members, 0) AS members
           FROM admin_castes c
           LEFT JOIN (
                SELECT caste_id AS id, COUNT(*) AS members FROM users_list WHERE caste_id IS NOT NULL GROUP BY caste_id
                UNION ALL
                SELECT subcaste_id, COUNT(*) FROM users_list WHERE subcaste_id IS NOT NULL GROUP BY subcaste_id
           ) n ON n.id = c.id
          ${activeOnly ? "WHERE c.status = 'active'" : ''}
          ORDER BY c.sort_order, c.name`,
    );
    const top = rows.filter((r) => r.parent_id == null).map((r) => ({ ...r, children: [] }));
    const byId = new Map(top.map((c) => [c.id, c]));
    for (const r of rows) if (r.parent_id != null) byId.get(r.parent_id)?.children.push(r);
    return top;
}

/** Flat option lists for selects: castes, and sub-castes keyed by caste id. Memoised (castes change rarely). */
export async function casteOptions(locale) {
    const tree = await memo('castes:active', () => listCastes({ activeOnly: true }));
    const label = (c) => (locale === 'gu' && c.name_local) || c.name;
    return {
        castes: tree.map((c) => ({ value: String(c.id), label: label(c) })),
        subcastes: Object.fromEntries(
            tree.map((c) => [String(c.id), c.children.map((s) => ({ value: String(s.id), label: label(s) }))]),
        ),
    };
}
