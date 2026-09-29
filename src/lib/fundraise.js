import 'server-only';
import { getMeta, getMetaMany, inList, query, queryOne } from './db';
import { adminGroupIds } from './access';
import { canManageAllFundraises } from './roles';

export const CAMPAIGN_STATUSES = ['active', 'draft', 'closed'];
export const PAY_MODES = ['cash', 'upi', 'bank', 'cheque', 'other'];
const TOKEN_RE = /^[A-Za-z0-9_-]{24}$/;

// Totals as correlated subqueries: each hits idx_fundraise_*_camp, so a page of 20
// campaigns costs 40 index range reads instead of a join that multiplies rows.
const TOTALS = `
    (SELECT COALESCE(SUM(amount), 0) FROM fundraise_contributions fc WHERE fc.campaign_id = c.id) AS collected,
    (SELECT COUNT(*) FROM fundraise_contributions fc WHERE fc.campaign_id = c.id) AS contribution_count,
    (SELECT COALESCE(SUM(amount), 0) FROM fundraise_expenses fe WHERE fe.campaign_id = c.id) AS spent,
    (SELECT COUNT(*) FROM fundraise_expenses fe WHERE fe.campaign_id = c.id) AS expense_count`;

const COLS = `c.id, c.group_id, c.title, c.title_gu, c.location, c.target_amount, c.start_date, c.end_date, c.status,
    c.is_public, c.public_token, c.created_at, g.name AS group_name, g.name_gu AS group_name_gu`;

/**
 * Drafts are visible only to people who can manage them: app-level fundraise managers,
 * or admins of the draft's group.
 */
async function visibilityClause(user) {
    if (canManageAllFundraises(user.role)) return { sql: '1 = 1', params: {} };
    const ids = await adminGroupIds(user.id);
    if (!ids.length) return { sql: "c.status <> 'draft'", params: {} };
    const list = inList(ids, 'vg');
    return { sql: `(c.status <> 'draft' OR c.group_id IN (${list.sql}))`, params: list.params };
}

/**
 * @param {{id: number, role: string}} user
 * @param {{ status?: string, groupId?: number|null, location?: string, village?: string|null, page: number, perPage: number }} f
 *   village — the viewer's own village: those campaigns sort first and carry near = 1.
 */
export async function listCampaigns(user, { status, groupId, location, village, page, perPage }) {
    const vis = await visibilityClause(user);
    const where = [vis.sql];
    const params = { ...vis.params };
    if (status) {
        where.push('c.status = :status');
        params.status = status;
    }
    if (groupId) {
        where.push('c.group_id = :groupId');
        params.groupId = groupId;
    }
    if (location) {
        where.push('c.location = :location');
        params.location = location;
    }
    const whereSql = where.join(' AND ');
    // perPage/offset are clamped integers — inlined deliberately (DESIGN.md §9).
    const offset = (page - 1) * perPage;
    const [rows, count] = await Promise.all([
        query(
            `SELECT ${COLS}, ${TOTALS}, (c.location IS NOT NULL AND c.location = :village) AS near
               FROM fundraise_campaigns c LEFT JOIN admin_groups g ON g.id = c.group_id
              WHERE ${whereSql}
              ORDER BY near DESC, FIELD(c.status, 'active', 'draft', 'closed'), c.start_date IS NULL, c.start_date DESC, c.id DESC
              LIMIT ${perPage} OFFSET ${offset}`,
            { ...params, village: village || '' },
        ),
        queryOne(`SELECT COUNT(*) AS n FROM fundraise_campaigns c WHERE ${whereSql}`, params),
    ]);
    return { rows, total: count.n };
}

export async function getCampaign(id) {
    if (!Number.isInteger(id) || id <= 0) return null;
    const row = await queryOne(
        `SELECT ${COLS}, ${TOTALS}
           FROM fundraise_campaigns c LEFT JOIN admin_groups g ON g.id = c.group_id
          WHERE c.id = :id`,
        { id },
    );
    if (!row) return null;
    row.meta = await getMeta('fundraise_campaigns', id);
    return row;
}

/** Public lookup: only a well-formed token of a campaign that is currently public. */
export async function getCampaignByToken(token) {
    if (!TOKEN_RE.test(String(token ?? ''))) return null;
    const row = await queryOne(
        `SELECT ${COLS}, ${TOTALS}
           FROM fundraise_campaigns c LEFT JOIN admin_groups g ON g.id = c.group_id
          WHERE c.public_token = :token AND c.is_public = 1 AND c.status <> 'draft'`,
        { token },
    );
    if (!row) return null;
    row.meta = await getMeta('fundraise_campaigns', row.id);
    return row;
}

/** @param {{ limit?: number, offset?: number }} [opts] omit for all rows (statement / print). */
export async function listContributions(campaignId, { limit, offset = 0 } = {}) {
    const page = limit ? `LIMIT ${Number(limit)} OFFSET ${Number(offset)}` : '';
    return query(
        `SELECT id, user_id, donor_name, amount, paid_on, mode, reference, is_anonymous, created_at
           FROM fundraise_contributions WHERE campaign_id = :campaignId
          ORDER BY paid_on DESC, id DESC ${page}`,
        { campaignId },
    );
}

export async function listExpenses(campaignId, { limit, offset = 0 } = {}) {
    const page = limit ? `LIMIT ${Number(limit)} OFFSET ${Number(offset)}` : '';
    const rows = await query(
        `SELECT id, title, place, category, amount, spent_on, created_at
           FROM fundraise_expenses WHERE campaign_id = :campaignId
          ORDER BY spent_on DESC, id DESC ${page}`,
        { campaignId },
    );
    const meta = await getMetaMany('fundraise_expenses', rows.map((r) => r.id), ['notes', 'bill_ref']);
    return rows.map((r) => ({ ...r, notes: meta[r.id]?.notes ?? '', bill_ref: meta[r.id]?.bill_ref ?? '' }));
}

// Two literal SQL variants rather than a bound flag: under ONLY_FULL_GROUP_BY the SELECT
// expression must match the GROUP BY expression textually, and a placeholder in both
// is not recognised as the same expression.
const CONTRIB_KEY = `COALESCE(CONCAT('u:', user_id), CONCAT('n:', donor_name))`;
const PUBLIC_KEY = `IF(is_anonymous = 1, 'anon', ${CONTRIB_KEY})`;

/**
 * One row per contributor: a member is keyed by user_id (so name edits do not split
 * them), a free-text donor by name. The public view folds anonymous gifts into one row.
 */
export async function contributorTotals(campaignId, { publicView = false } = {}) {
    const key = publicView ? PUBLIC_KEY : CONTRIB_KEY;
    return query(
        `SELECT ${key} AS k, MAX(donor_name) AS donor_name, MAX(user_id) AS user_id,
                MAX(is_anonymous) AS is_anonymous, SUM(amount) AS total, COUNT(*) AS entries,
                MAX(paid_on) AS last_paid
           FROM fundraise_contributions WHERE campaign_id = :campaignId
          GROUP BY ${key}
          ORDER BY total DESC, donor_name`,
        { campaignId },
    );
}

export async function listGroupsForSelect() {
    return query(`SELECT id, name, name_gu FROM admin_groups WHERE status = 'active' ORDER BY name`);
}

export function progressPct(campaign) {
    const target = Number(campaign.target_amount || 0);
    if (!target) return null;
    return Math.min(100, Math.round((Number(campaign.collected) / target) * 100));
}

// ── locations / personal views ────────────────────────────────────────────────

/** Distinct campaign locations the viewer can see, with counts, for the ?location= select. */
export async function locationCounts(user) {
    const vis = await visibilityClause(user);
    return query(
        `SELECT c.location, COUNT(*) AS n FROM fundraise_campaigns c
          WHERE ${vis.sql} AND c.location IS NOT NULL AND c.location <> ''
          GROUP BY c.location ORDER BY c.location`,
        vis.params,
    );
}

/** Suggestions for the location field: members' villages ∪ locations already used. */
export async function knownLocations() {
    const rows = await query(
        `SELECT village AS v FROM users_list WHERE village IS NOT NULL AND village <> ''
         UNION
         SELECT location AS v FROM fundraise_campaigns WHERE location IS NOT NULL AND location <> ''
         ORDER BY v`,
    );
    return rows.map((r) => r.v);
}

export async function userVillage(userId) {
    const row = await queryOne('SELECT village FROM users_list WHERE id = :userId', { userId });
    return row?.village || null;
}

/** My donations across every fundraise, newest first, plus my overall total. */
export async function myContributions(userId, { page, perPage }) {
    const offset = (page - 1) * perPage;
    const [rows, sum] = await Promise.all([
        query(
            `SELECT fc.id, fc.amount, fc.paid_on, fc.mode, fc.is_anonymous,
                    c.id AS campaign_id, c.title, c.title_gu, c.location, c.status
               FROM fundraise_contributions fc JOIN fundraise_campaigns c ON c.id = fc.campaign_id
              WHERE fc.user_id = :userId
              ORDER BY fc.paid_on DESC, fc.id DESC
              LIMIT ${perPage} OFFSET ${offset}`,
            { userId },
        ),
        queryOne(
            `SELECT COUNT(*) AS n, COALESCE(SUM(amount), 0) AS total, COUNT(DISTINCT campaign_id) AS campaigns
               FROM fundraise_contributions WHERE user_id = :userId`,
            { userId },
        ),
    ]);
    return { rows, total: sum.n, amount: sum.total, campaigns: sum.campaigns };
}

/** Fundraises where the user holds a team role. */
export async function myTeamCampaigns(userId) {
    return query(
        `SELECT ${COLS}, ${TOTALS}, fm.member_role
           FROM fundraise_members fm
           JOIN fundraise_campaigns c ON c.id = fm.campaign_id
           LEFT JOIN admin_groups g ON g.id = c.group_id
          WHERE fm.user_id = :userId
          ORDER BY FIELD(c.status, 'active', 'draft', 'closed'), c.id DESC`,
        { userId },
    );
}

// ── team ──────────────────────────────────────────────────────────────────────

export async function listTeam(campaignId) {
    return query(
        `SELECT fm.user_id, fm.member_role, fm.added_at, u.full_name, u.full_name_gu, u.phone, u.village
           FROM fundraise_members fm JOIN users_list u ON u.id = fm.user_id
          WHERE fm.campaign_id = :campaignId
          ORDER BY FIELD(fm.member_role, 'organizer', 'treasurer', 'collector', 'volunteer'), u.full_name`,
        { campaignId },
    );
}

// ── meetings (events_list rows with campaign_id, event_type = 'meeting') ─────

/** All meetings with agenda and minutes count; split into upcoming / past by `today`. */
export async function listMeetings(campaignId, today) {
    const rows = await query(
        `SELECT e.id, e.title, e.title_gu, e.start_date, e.start_time, e.location,
                (SELECT COUNT(*) FROM fundraise_updates u WHERE u.event_id = e.id AND u.update_type = 'minutes') AS minutes_count
           FROM events_list e
          WHERE e.campaign_id = :campaignId AND e.event_type = 'meeting'
          ORDER BY e.start_date, e.start_time`,
        { campaignId },
    );
    const meta = await getMetaMany('events_list', rows.map((r) => r.id), ['description']);
    const all = rows.map((r) => ({ ...r, agenda: meta[r.id]?.description ?? '' }));
    return {
        upcoming: all.filter((m) => m.start_date >= today),
        past: all.filter((m) => m.start_date < today).reverse(),
    };
}

export async function nextMeeting(campaignId, today) {
    return queryOne(
        `SELECT id, start_date, start_time, location FROM events_list
          WHERE campaign_id = :campaignId AND event_type = 'meeting' AND start_date >= :today
          ORDER BY start_date, start_time LIMIT 1`,
        { campaignId, today },
    );
}

// ── updates & minutes ─────────────────────────────────────────────────────────

/** Timeline, newest first. `eventId` narrows to one meeting's minutes. */
export async function listUpdates(campaignId, { eventId = null } = {}) {
    const rows = await query(
        `SELECT fu.id, fu.update_type, fu.event_id, fu.created_by, fu.created_at,
                u.full_name AS author, u.full_name_gu AS author_gu,
                e.start_date AS meeting_date
           FROM fundraise_updates fu
           LEFT JOIN users_list u ON u.id = fu.created_by
           LEFT JOIN events_list e ON e.id = fu.event_id
          WHERE fu.campaign_id = :campaignId ${eventId ? 'AND fu.event_id = :eventId' : ''}
          ORDER BY fu.created_at DESC, fu.id DESC
          LIMIT 200`,
        eventId ? { campaignId, eventId } : { campaignId },
    );
    const meta = await getMetaMany('fundraise_updates', rows.map((r) => r.id), ['body']);
    return rows.map((r) => ({ ...r, body: meta[r.id]?.body ?? '' }));
}
