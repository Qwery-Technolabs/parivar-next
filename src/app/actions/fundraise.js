'use server';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canCreateFundraiseIn, FUNDRAISE_TEAM_ROLES, fundraisePermissions } from '@/lib/access';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { inList, query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { bool, date, id, money, oneOf, str, strOrNull } from '@/lib/forms';
import { AUDIENCE_KINDS, CAMPAIGN_STATUSES, listHistory, PAY_MODES } from '@/lib/fundraise';
import { ensureInvitedUser } from '@/lib/invite';
import { fundraiseAudienceIds, notify, notifyMany } from '@/lib/notifications';
import { canManageAllFundraises } from '@/lib/roles';
import { sanitizeAvatar } from '@/lib/group-avatar';
import { normalizePhone } from '@/lib/phone';
import { getSettings } from '@/lib/settings';

const FORBIDDEN = { error: 'common.forbidden' };

const newToken = () => randomBytes(18).toString('base64url'); // 24 url-safe chars

/**
 * Load the campaign and check the signed-in user holds `perm` on it
 * (manage | contribution | expense | post — see fundraisePermissions).
 */
async function authorize(campaignId, perm = 'manage') {
    const user = await getCurrentUser();
    if (!user || !campaignId) return { user: null, campaign: null };
    const campaign = await queryOne(
        'SELECT id, group_id, title, title_local, is_public, public_token FROM fundraise_campaigns WHERE id = :campaignId',
        { campaignId },
    );
    if (!campaign) return { user: null, campaign: null };
    const perms = await fundraisePermissions(user, campaign);
    if (!perms[perm]) return { user: null, campaign: null };
    return { user, campaign, perms };
}

function refreshCampaign(campaignId) {
    revalidatePath('/fundraise');
    revalidatePath(`/fundraise/${campaignId}`);
}

// ── campaign ──────────────────────────────────────────────────────────────────

const MAX_AUDIENCE = 30;

/**
 * Audience rows from the form: audience_surname[] (the surname multi-select, one row each)
 * plus the parallel audience_kind[] / audience_value[] rows for the other kinds.
 * Unknown kinds and blank values are dropped; duplicates are removed case-insensitively
 * (the unique key is case-insensitive too, so a "Patel"/"patel" pair would otherwise fail
 * the insert). caste / subcaste must be a real admin_castes id at the right level.
 * @returns {Promise<Array<{kind: string, value: string}> | null>} null = invalid caste id
 */
async function parseAudience(fd) {
    const clean = (v) => String(v).trim().replace(/\s+/g, ' ').slice(0, 150);
    const surnames = fd.getAll('audience_surname').map(clean);
    const kinds = [...surnames.map(() => 'surname'), ...fd.getAll('audience_kind').map(String)];
    const values = [...surnames, ...fd.getAll('audience_value').map(clean)];
    const seen = new Set();
    const rows = [];
    kinds.forEach((kind, i) => {
        const value = values[i] ?? '';
        if (!AUDIENCE_KINDS.includes(kind) || !value) return;
        const key = `${kind}|${value.toLowerCase()}`;
        if (seen.has(key)) return;
        seen.add(key);
        rows.push({ kind, value });
    });
    const casteRows = rows.filter((r) => r.kind === 'caste' || r.kind === 'subcaste');
    if (casteRows.length) {
        if (casteRows.some((r) => !/^\d+$/.test(r.value))) return null;
        const l = inList(casteRows.map((r) => Number(r.value)), 'ca');
        const found = await query(`SELECT id, parent_id FROM admin_castes WHERE id IN (${l.sql})`, l.params);
        const byId = new Map(found.map((r) => [String(r.id), r]));
        for (const r of casteRows) {
            const row = byId.get(r.value);
            if (!row || (r.kind === 'caste') !== (row.parent_id == null)) return null;
        }
    }
    return rows.slice(0, MAX_AUDIENCE);
}

/** Replace a campaign's audience rules (inside the caller's transaction). */
async function writeAudience(q, campaignId, rows) {
    await q('DELETE FROM fundraise_audience WHERE campaign_id = :campaignId', { campaignId });
    for (const r of rows)
        await q('INSERT INTO fundraise_audience (campaign_id, kind, value) VALUES (:campaignId, :kind, :value)', {
            campaignId,
            kind: r.kind,
            value: r.value,
        });
}

/**
 * The groups a fundraise is shown in (fundraise_groups): the home group plus extras.
 * Adding or removing a group needs the right to start a fundraise there; links the editor
 * cannot manage are kept as they are. Returns an error key when an extra is not allowed.
 */
async function planCampaignGroups(user, campaignId, homeId, extraIds) {
    // A standalone fundraise (no home group) may still be shown in groups.
    const wanted = new Set([homeId, ...extraIds].filter(Boolean));
    const existing = campaignId
        ? new Set((await query('SELECT group_id FROM fundraise_groups WHERE campaign_id = :campaignId', { campaignId })).map((r) => r.group_id))
        : new Set();
    const add = [...wanted].filter((g) => !existing.has(g));
    const drop = [...existing].filter((g) => !wanted.has(g));
    for (const g of add) {
        // The home group was already checked by the caller.
        if (g !== homeId && !(await canCreateFundraiseIn(user, g))) return { error: 'fundraise.errors.extraGroup' };
    }
    const dropAllowed = [];
    for (const g of drop) if (await canCreateFundraiseIn(user, g)) dropAllowed.push(g);
    const exists = add.length ? await query(`SELECT id FROM admin_groups WHERE id IN (${add.map((_, i) => `:g${i}`).join(',')})`, Object.fromEntries(add.map((g, i) => [`g${i}`, g]))) : [];
    if (exists.length !== add.length) return { error: 'fundraise.errors.extraGroup' };
    return { add, drop: dropAllowed };
}

async function writeCampaignGroups(q, campaignId, plan, userId) {
    for (const g of plan.add) {
        await q('INSERT IGNORE INTO fundraise_groups (campaign_id, group_id, added_by) VALUES (:campaignId, :g, :userId)', { campaignId, g, userId });
    }
    for (const g of plan.drop) {
        await q('DELETE FROM fundraise_groups WHERE campaign_id = :campaignId AND group_id = :g', { campaignId, g });
    }
}

export async function saveCampaign(prev, fd) {
    const user = await getCurrentUser();
    if (!user) return FORBIDDEN;

    const campaignId = id(fd, 'id');
    const groupId = id(fd, 'group_id');
    // Also shown in these groups (besides the home group).
    const extraGroupIds = [...new Set(fd.getAll('extra_group_ids').map(Number))].filter((n) => n > 0 && n !== groupId).slice(0, 50);
    const title = str(fd, 'title', 200);
    const rawTarget = str(fd, 'target_amount', 20);
    const target = rawTarget ? money(fd, 'target_amount') : null;
    const rawStart = str(fd, 'start_date');
    const rawEnd = str(fd, 'end_date');
    const start = date(fd, 'start_date');
    const end = date(fd, 'end_date');

    const fieldErrors = {};
    if (!title) fieldErrors.title = 'fundraise.errors.title';
    if (rawTarget && target == null) fieldErrors.target_amount = 'fundraise.errors.target';
    if (rawStart && !start) fieldErrors.start_date = 'fundraise.errors.date';
    if (rawEnd && !end) fieldErrors.end_date = 'fundraise.errors.date';
    if (start && end && end < start) fieldErrors.end_date = 'fundraise.errors.dates';
    // No group = a standalone fundraise; only fundraise managers may start or keep one (checked below).
    const audience = await parseAudience(fd);
    if (!audience) fieldErrors.audience = 'fundraise.errors.audience';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    if (groupId && !(await queryOne('SELECT id FROM admin_groups WHERE id = :groupId', { groupId }))) {
        return { fieldErrors: { group_id: 'fundraise.errors.group' } };
    }
    if (!groupId && !canManageAllFundraises(user.role)) return { fieldErrors: { group_id: 'fundraise.errors.group' } };

    const row = {
        groupId,
        title,
        titleLocal: strOrNull(fd, 'title_local', 200),
        target,
        start,
        end,
        status: oneOf(fd, 'status', CAMPAIGN_STATUSES, 'active'),
        location: strOrNull(fd, 'location', 100),
    };
    const meta = {
        description: str(fd, 'description', 20000),
        // Picture: icon / emoji / ≤2 letters on a colour, like a group's (lib/group-avatar).
        ...sanitizeAvatar(str(fd, 'avatar_kind', 10), str(fd, 'avatar_value', 40), str(fd, 'avatar_color', 10)),
        // No local-language description on the form any more; an older one is left as it is.
    };

    if (campaignId) {
        const { campaign } = await authorize(campaignId);
        if (!campaign) return FORBIDDEN;
        // Moving a fundraise into another group needs the right to create there too.
        if (groupId !== campaign.group_id && !(await canCreateFundraiseIn(user, groupId)))
            return { fieldErrors: { group_id: 'fundraise.errors.group' } };
        const plan = await planCampaignGroups(user, campaignId, groupId, extraGroupIds);
        if (plan.error) return { fieldErrors: { extra_group_ids: plan.error } };
        await withTransaction(async (q) => {
            await q(
                `UPDATE fundraise_campaigns
                    SET group_id = :groupId, title = :title, title_local = :titleLocal, location = :location, target_amount = :target,
                        start_date = :start, end_date = :end, status = :status
                  WHERE id = :campaignId`,
                { ...row, campaignId },
            );
            await setMeta('fundraise_campaigns', campaignId, meta, q);
            await writeAudience(q, campaignId, audience);
            await writeCampaignGroups(q, campaignId, plan, user.id);
        });
        await audit(user.id, 'fundraise.update', 'fundraise', campaignId, { title, audience: audience.length });
        refreshCampaign(campaignId);
        redirect(`/fundraise/${campaignId}`);
    }

    if (!(await canCreateFundraiseIn(user, groupId))) return { fieldErrors: { group_id: 'fundraise.errors.group' } };
    const plan = await planCampaignGroups(user, null, groupId, extraGroupIds);
    if (plan.error) return { fieldErrors: { extra_group_ids: plan.error } };
    // The public switch on the create form defaults to the fundraise_settings.default_public value.
    const isPublic = bool(fd, 'is_public');
    const newId = await withTransaction(async (q) => {
        const r = await q(
            `INSERT INTO fundraise_campaigns (group_id, title, title_local, location, target_amount, start_date, end_date, status, is_public, public_token, created_by)
             VALUES (:groupId, :title, :titleLocal, :location, :target, :start, :end, :status, :isPublic, :token, :by)`,
            { ...row, isPublic: isPublic ? 1 : 0, token: isPublic ? newToken() : null, by: user.id },
        );
        await setMeta('fundraise_campaigns', r.insertId, meta, q);
        await writeAudience(q, r.insertId, audience);
        await writeCampaignGroups(q, r.insertId, plan, user.id);
        // The creator is admin of this fundraise by default (fundraise-level, independent of
        // their group role); other admins can demote them later.
        await q(
            `INSERT INTO fundraise_members (campaign_id, user_id, member_role, added_by) VALUES (:cid, :uid, 'admin', :uid)
             ON DUPLICATE KEY UPDATE member_role = 'admin'`,
            { cid: r.insertId, uid: user.id },
        );
        return r.insertId;
    });
    await audit(user.id, 'fundraise.create', 'fundraise', newId, { title, audience: audience.length });
    revalidatePath('/fundraise');
    redirect(`/fundraise/${newId}`);
}

/**
 * Archive / restore a fundraise (project admins). Archived: out of every list, the group tabs
 * and its public link, kept intact — and only then deletable.
 */
export async function setCampaignArchived(campaignId, archived) {
    const user = await getCurrentUser();
    if (!user || !canManageAllFundraises(user.role)) return FORBIDDEN;
    const c = await queryOne('SELECT id, title FROM fundraise_campaigns WHERE id = :campaignId', { campaignId });
    if (!c) return FORBIDDEN;
    await query(`UPDATE fundraise_campaigns SET archived_at = ${archived ? 'NOW()' : 'NULL'} WHERE id = :campaignId`, { campaignId });
    await audit(user.id, archived ? 'fundraise.archive' : 'fundraise.restore', 'fundraise', campaignId, { title: c.title });
    revalidatePath('/fundraise');
    refreshCampaign(campaignId);
    return { ok: true, message: archived ? 'fundraise.archived' : 'fundraise.restored' };
}

export async function deleteCampaign(campaignId) {
    const user = await getCurrentUser();
    // Deleting wipes the ledger, so it is not delegated to group admins.
    if (!user || !canManageAllFundraises(user.role)) return FORBIDDEN;
    const c = await queryOne('SELECT id, title, archived_at FROM fundraise_campaigns WHERE id = :campaignId', { campaignId });
    if (!c) return FORBIDDEN;
    // Only an archived fundraise can be deleted: archiving first is the safety step.
    if (!c.archived_at) return { error: 'fundraise.errors.archiveFirst' };
    await query('DELETE FROM fundraise_campaigns WHERE id = :campaignId', { campaignId });
    await audit(user.id, 'fundraise.delete', 'fundraise', campaignId, { title: c.title });
    revalidatePath('/fundraise');
    redirect('/fundraise');
}

// ── public link ───────────────────────────────────────────────────────────────

export async function setPublic(campaignId, makePublic) {
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;
    const token = campaign.public_token || newToken();
    await query('UPDATE fundraise_campaigns SET is_public = :pub, public_token = :token WHERE id = :campaignId', {
        pub: makePublic ? 1 : 0,
        token,
        campaignId,
    });
    await audit(user.id, makePublic ? 'fundraise.public.on' : 'fundraise.public.off', 'fundraise', campaignId);
    refreshCampaign(campaignId);
    return { ok: true, message: makePublic ? 'fundraise.publicEnabled' : 'fundraise.publicDisabled', token };
}

export async function regenerateToken(campaignId) {
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;
    const token = newToken();
    await query('UPDATE fundraise_campaigns SET public_token = :token WHERE id = :campaignId', { token, campaignId });
    await audit(user.id, 'fundraise.public.regenerate', 'fundraise', campaignId);
    refreshCampaign(campaignId);
    return { ok: true, message: 'fundraise.regenerated', token };
}

// ── ledger history ────────────────────────────────────────────────────────────
// Contributions and expenses are edited in place and soft-deleted; each add / edit / delete
// writes a fundraise_history row in the same transaction as the change, so the history can
// never disagree with the ledger.

async function contributionSnapshot(q, contributionId) {
    const [row] = await q(
        `SELECT id, user_id, donor_name, amount, paid_on, mode, reference, is_anonymous, deleted_at
           FROM fundraise_contributions WHERE id = :contributionId`,
        { contributionId },
    );
    return row ? { ...row, amount: Number(row.amount), is_anonymous: Number(row.is_anonymous) } : null;
}

async function expenseSnapshot(q, expenseId) {
    const [row] = await q(
        `SELECT id, title, place, category, amount, spent_on, deleted_at FROM fundraise_expenses WHERE id = :expenseId`,
        { expenseId },
    );
    if (!row) return null;
    const meta = await q(
        `SELECT meta_key, meta_value FROM fundraise_expensesmeta WHERE expense_id = :expenseId AND meta_key IN ('notes', 'bill_ref')`,
        { expenseId },
    );
    const m = Object.fromEntries(meta.map((r) => [r.meta_key, r.meta_value]));
    return { ...row, amount: Number(row.amount), notes: m.notes ?? null, bill_ref: m.bill_ref ?? null };
}

async function writeHistory(q, { campaignId, entity, entityId, action, actorId, snapshot }) {
    await q(
        `INSERT INTO fundraise_history (campaign_id, entity, entity_id, action, actor_id, snapshot)
         VALUES (:campaignId, :entity, :entityId, :action, :actorId, :snapshot)`,
        { campaignId, entity, entityId, action, actorId, snapshot: JSON.stringify(snapshot) },
    );
}

// ── contributions ─────────────────────────────────────────────────────────────

/**
 * A pending (unpaid) pledge came in: set how and when it was paid. Only rows still 'unpaid'
 * change; the edit goes into the entry's history like any other.
 */
export async function markContributionPaid(prev, fd) {
    const campaignId = id(fd, 'campaign_id');
    const { user, campaign } = await authorize(campaignId, 'contribution');
    if (!campaign) return FORBIDDEN;
    const contributionId = id(fd, 'contribution_id');
    const mode = oneOf(fd, 'mode', PAY_MODES.filter((m) => m !== 'unpaid'));
    const paidOn = date(fd, 'paid_on');
    const fieldErrors = {};
    if (!mode) fieldErrors.mode = 'common.required';
    if (!paidOn) fieldErrors.paid_on = 'fundraise.errors.date';
    if (Object.keys(fieldErrors).length) return { fieldErrors };
    const done = await withTransaction(async (q) => {
        const before = await contributionSnapshot(q, contributionId);
        const r = await q(
            `UPDATE fundraise_contributions SET mode = :mode, paid_on = :paidOn
              WHERE id = :contributionId AND campaign_id = :campaignId AND mode = 'unpaid' AND deleted_at IS NULL`,
            { mode, paidOn, contributionId, campaignId },
        );
        if (!r.affectedRows) return false;
        const after = await contributionSnapshot(q, contributionId);
        await writeHistory(q, { campaignId, entity: 'contribution', entityId: contributionId, action: 'edit', actorId: user.id, snapshot: { ...after, before } });
        return true;
    });
    if (!done) return { error: 'fundraise.errors.notPending' };
    await audit(user.id, 'fundraise.contribution.paid', 'fundraise', campaignId, { contribution: contributionId, mode });
    refreshCampaign(campaignId);
    return { ok: true, message: 'fundraise.markedPaid' };
}

/** Add (no contribution_id) or edit a contribution. Needs perms.manage. */
export async function saveContribution(prev, fd) {
    const campaignId = id(fd, 'campaign_id');
    const { user, campaign } = await authorize(campaignId, 'contribution');
    if (!campaign) return FORBIDDEN;

    const contributionId = id(fd, 'contribution_id');
    const rawUser = str(fd, 'user_id', 40);
    const invitePhone = rawUser.startsWith('phone:') ? normalizePhone(rawUser.slice(6)) : null;
    const userId = invitePhone ? null : id(fd, 'user_id');
    let donorName = str(fd, 'donor_name', 150);
    const amount = money(fd, 'amount');
    const paidOn = date(fd, 'paid_on');

    let member = null;
    if (userId) {
        member = await queryOne('SELECT id, full_name FROM users_list WHERE id = :userId', { userId });
        // The name is always stored with the row so the public list never changes under it.
        if (member && !donorName) donorName = member.full_name;
    }

    const fieldErrors = {};
    if (!donorName) fieldErrors.donor_name = 'fundraise.errors.donor';
    if (rawUser.startsWith('phone:') && !invitePhone) fieldErrors.user_id = 'auth.errors.phoneInvalid';
    if (amount == null) fieldErrors.amount = 'fundraise.errors.amount';
    if (!paidOn) fieldErrors.paid_on = 'fundraise.errors.date';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    // Not a member yet: invite the number (the typed name becomes theirs) and link the gift to them.
    let invitedId = null;
    if (invitePhone) {
        const inv = await ensureInvitedUser(user, invitePhone, donorName);
        if (inv.error) return { fieldErrors: { user_id: inv.error } };
        member = { id: inv.id };
        invitedId = inv.status === 'existing' ? null : inv.id;
    }

    const values = {
        campaignId,
        userId: member?.id ?? null,
        donorName,
        amount,
        paidOn,
        mode: oneOf(fd, 'mode', PAY_MODES, 'cash'),
        reference: strOrNull(fd, 'reference', 100),
        // Forced off server-side when the setting disallows it — hiding the switch enforces nothing.
        anon: bool(fd, 'is_anonymous') && (await getSettings('fundraise')).allow_anonymous ? 1 : 0,
    };

    const result = await withTransaction(async (q) => {
        if (contributionId) {
            // campaign_id + deleted_at in the WHERE: a forged or deleted id changes nothing.
            const before = await contributionSnapshot(q, contributionId);
            const [owner] = await q(
                'SELECT 1 AS ok FROM fundraise_contributions WHERE id = :contributionId AND campaign_id = :campaignId AND deleted_at IS NULL',
                { contributionId, campaignId },
            );
            if (!before || !owner) return null;
            await q(
                `UPDATE fundraise_contributions
                    SET user_id = :userId, donor_name = :donorName, amount = :amount, paid_on = :paidOn,
                        mode = :mode, reference = :reference, is_anonymous = :anon
                  WHERE id = :contributionId AND campaign_id = :campaignId`,
                { ...values, contributionId },
            );
            const after = await contributionSnapshot(q, contributionId);
            await writeHistory(q, {
                campaignId,
                entity: 'contribution',
                entityId: contributionId,
                action: 'edit',
                actorId: user.id,
                snapshot: { ...after, before },
            });
            return { id: contributionId, action: 'edit' };
        }
        const r = await q(
            `INSERT INTO fundraise_contributions
                (campaign_id, user_id, donor_name, amount, paid_on, mode, reference, is_anonymous, recorded_by)
             VALUES (:campaignId, :userId, :donorName, :amount, :paidOn, :mode, :reference, :anon, :by)`,
            { ...values, by: user.id },
        );
        await writeHistory(q, {
            campaignId,
            entity: 'contribution',
            entityId: r.insertId,
            action: 'add',
            actorId: user.id,
            snapshot: await contributionSnapshot(q, r.insertId),
        });
        return { id: r.insertId, action: 'add' };
    });
    if (!result) return FORBIDDEN;

    await audit(user.id, `fundraise.contribution.${result.action}`, 'fundraise', campaignId, {
        contribution: result.id,
        donor: donorName,
        amount,
    });
    refreshCampaign(campaignId);
    // Point the newly invited person at the fundraise: they see it on first sign-in.
    if (invitedId) {
        await notifyMany([invitedId], {
            type: 'fundraise.contribution_invite',
            data: { title: campaign.title, title_local: campaign.title_local },
            link: `/fundraise/${campaignId}`,
            actorId: user.id,
        });
    }
    return { ok: true, message: result.action === 'edit' ? 'fundraise.contributionUpdated' : 'fundraise.contributionAdded' };
}

/** Soft delete: the row stays (hidden, out of totals) so its history remains complete. */
export async function deleteContribution(campaignId, contributionId) {
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;
    const snap = await withTransaction(async (q) => {
        const r = await q(
            `UPDATE fundraise_contributions SET deleted_at = NOW(), deleted_by = :by
              WHERE id = :contributionId AND campaign_id = :campaignId AND deleted_at IS NULL`,
            { by: user.id, contributionId, campaignId },
        );
        if (!r.affectedRows) return null;
        const s = await contributionSnapshot(q, contributionId);
        await writeHistory(q, { campaignId, entity: 'contribution', entityId: contributionId, action: 'delete', actorId: user.id, snapshot: s });
        return s;
    });
    if (!snap) return FORBIDDEN;
    await audit(user.id, 'fundraise.contribution.delete', 'fundraise', campaignId, {
        contribution: contributionId,
        donor: snap.donor_name,
        amount: snap.amount,
    });
    refreshCampaign(campaignId);
    return { ok: true, message: 'common.deleted' };
}

// ── expenses ──────────────────────────────────────────────────────────────────

/** Add (no expense_id) or edit an expense. Needs perms.manage. */
export async function saveExpense(prev, fd) {
    const campaignId = id(fd, 'campaign_id');
    const { user, campaign } = await authorize(campaignId, 'expense');
    if (!campaign) return FORBIDDEN;

    const expenseId = id(fd, 'expense_id');
    const title = str(fd, 'title', 200);
    const amount = money(fd, 'amount');
    const spentOn = date(fd, 'spent_on');

    const fieldErrors = {};
    if (!title) fieldErrors.title = 'fundraise.errors.what';
    if (amount == null) fieldErrors.amount = 'fundraise.errors.amount';
    if (!spentOn) fieldErrors.spent_on = 'fundraise.errors.date';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    const values = {
        campaignId,
        title,
        place: strOrNull(fd, 'place', 200),
        // Any stored category is accepted, so a row keeps a category later removed from settings.
        category: strOrNull(fd, 'category', 64),
        amount,
        spentOn,
    };
    const meta = { notes: str(fd, 'notes', 5000), bill_ref: str(fd, 'bill_ref', 100) };

    const result = await withTransaction(async (q) => {
        if (expenseId) {
            const [owner] = await q(
                'SELECT 1 AS ok FROM fundraise_expenses WHERE id = :expenseId AND campaign_id = :campaignId AND deleted_at IS NULL',
                { expenseId, campaignId },
            );
            if (!owner) return null;
            const before = await expenseSnapshot(q, expenseId);
            await q(
                `UPDATE fundraise_expenses
                    SET title = :title, place = :place, category = :category, amount = :amount, spent_on = :spentOn
                  WHERE id = :expenseId AND campaign_id = :campaignId`,
                { ...values, expenseId },
            );
            await setMeta('fundraise_expenses', expenseId, meta, q);
            const after = await expenseSnapshot(q, expenseId);
            await writeHistory(q, {
                campaignId,
                entity: 'expense',
                entityId: expenseId,
                action: 'edit',
                actorId: user.id,
                snapshot: { ...after, before },
            });
            return { id: expenseId, action: 'edit' };
        }
        const r = await q(
            `INSERT INTO fundraise_expenses (campaign_id, title, place, category, amount, spent_on, recorded_by)
             VALUES (:campaignId, :title, :place, :category, :amount, :spentOn, :by)`,
            { ...values, by: user.id },
        );
        await setMeta('fundraise_expenses', r.insertId, meta, q);
        await writeHistory(q, {
            campaignId,
            entity: 'expense',
            entityId: r.insertId,
            action: 'add',
            actorId: user.id,
            snapshot: await expenseSnapshot(q, r.insertId),
        });
        return { id: r.insertId, action: 'add' };
    });
    if (!result) return FORBIDDEN;

    await audit(user.id, `fundraise.expense.${result.action}`, 'fundraise', campaignId, { expense: result.id, title, amount });
    refreshCampaign(campaignId);
    return { ok: true, message: result.action === 'edit' ? 'fundraise.expenseUpdated' : 'fundraise.expenseAdded' };
}

/** Soft delete, like contributions. */
export async function deleteExpense(campaignId, expenseId) {
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;
    const snap = await withTransaction(async (q) => {
        const r = await q(
            `UPDATE fundraise_expenses SET deleted_at = NOW(), deleted_by = :by
              WHERE id = :expenseId AND campaign_id = :campaignId AND deleted_at IS NULL`,
            { by: user.id, expenseId, campaignId },
        );
        if (!r.affectedRows) return null;
        const s = await expenseSnapshot(q, expenseId);
        await writeHistory(q, { campaignId, entity: 'expense', entityId: expenseId, action: 'delete', actorId: user.id, snapshot: s });
        return s;
    });
    if (!snap) return FORBIDDEN;
    await audit(user.id, 'fundraise.expense.delete', 'fundraise', campaignId, {
        expense: expenseId,
        title: snap.title,
        amount: snap.amount,
    });
    refreshCampaign(campaignId);
    return { ok: true, message: 'common.deleted' };
}

/** One entry's history for the row "History" dialog. Any signed-in member may read it. */
export async function entryHistory(campaignId, entity, entityId) {
    const user = await getCurrentUser();
    if (!user || !['contribution', 'expense'].includes(entity)) return { error: 'common.forbidden' };
    const c = await queryOne('SELECT id, group_id, status FROM fundraise_campaigns WHERE id = :campaignId', { campaignId });
    if (!c) return { error: 'common.forbidden' };
    if (c.status === 'draft' && !(await fundraisePermissions(user, c)).manage) return { error: 'common.forbidden' };
    const rows = await listHistory(campaignId, { entity, entityId: Number(entityId), limit: 100 });
    return { ok: true, rows: rows.map((r) => ({ ...r, created_at: String(r.created_at) })) };
}

// ── team ──────────────────────────────────────────────────────────────────────

const campaignLink = (campaignId, tab) => `/fundraise/${campaignId}${tab ? `?tab=${tab}` : ''}`;

/** Add or re-role a team member (same form: an existing member just gets the new role). */
export async function saveTeamMember(prev, fd) {
    const campaignId = id(fd, 'campaign_id');
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;

    const userId = id(fd, 'user_id');
    const role = oneOf(fd, 'member_role', FUNDRAISE_TEAM_ROLES);
    const fieldErrors = {};
    if (!userId) fieldErrors.user_id = 'fundraise.errors.member';
    if (!role) fieldErrors.member_role = 'fundraise.errors.teamRole';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    const member = await queryOne('SELECT id, full_name FROM users_list WHERE id = :userId', { userId });
    if (!member) return { fieldErrors: { user_id: 'fundraise.errors.member' } };
    const before = await queryOne(
        'SELECT member_role FROM fundraise_members WHERE campaign_id = :campaignId AND user_id = :userId',
        { campaignId, userId },
    );
    if (before?.member_role === role) return { ok: true, message: 'fundraise.teamSaved' };
    // An admin cannot demote themselves (the fundraise could be left with nobody to run it);
    // another admin, or an app-level manager, has to do it.
    if (userId === user.id && before?.member_role === 'admin' && role !== 'admin' && !canManageAllFundraises(user.role)) {
        return { error: 'fundraise.errors.selfDemote' };
    }

    await query(
        `INSERT INTO fundraise_members (campaign_id, user_id, member_role, added_by)
         VALUES (:campaignId, :userId, :role, :by)
         ON DUPLICATE KEY UPDATE member_role = VALUES(member_role)`,
        { campaignId, userId, role, by: user.id },
    );
    await audit(user.id, before ? 'fundraise.team.role' : 'fundraise.team.add', 'fundraise', campaignId, {
        user: userId,
        role,
        from: before?.member_role ?? null,
    });
    await notify(userId, {
        type: 'fundraise.role',
        data: { title: campaign.title, role },
        link: campaignLink(campaignId, 'team'),
        actorId: user.id,
    });
    refreshCampaign(campaignId);
    return { ok: true, message: 'fundraise.teamSaved' };
}

export async function removeTeamMember(campaignId, userId) {
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;
    const row = await queryOne(
        'SELECT member_role FROM fundraise_members WHERE campaign_id = :campaignId AND user_id = :userId',
        { campaignId, userId },
    );
    if (!row) return FORBIDDEN;
    if (Number(userId) === user.id && row.member_role === 'admin' && !canManageAllFundraises(user.role)) {
        return { error: 'fundraise.errors.selfDemote' };
    }
    await query('DELETE FROM fundraise_members WHERE campaign_id = :campaignId AND user_id = :userId', { campaignId, userId });
    await audit(user.id, 'fundraise.team.remove', 'fundraise', campaignId, { user: userId, role: row.member_role });
    refreshCampaign(campaignId);
    return { ok: true, message: 'fundraise.teamRemoved' };
}

// ── meetings ──────────────────────────────────────────────────────────────────


/** Post an update, or minutes when meeting_id is given. Needs perms.post (manage or any team member). */
export async function postUpdate(prev, fd) {
    const campaignId = id(fd, 'campaign_id');
    const { user, campaign } = await authorize(campaignId, 'post');
    if (!campaign) return FORBIDDEN;

    const body = str(fd, 'body', 20000);
    if (!body) return { fieldErrors: { body: 'fundraise.errors.body' } };

    const meetingId = id(fd, 'meeting_id');
    if (meetingId) {
        const m = await queryOne(
            `SELECT id FROM events_list WHERE id = :meetingId AND campaign_id = :campaignId AND event_type = 'meeting'`,
            { meetingId, campaignId },
        );
        if (!m) return FORBIDDEN;
    }
    const type = meetingId ? 'minutes' : 'update';

    const updateId = await withTransaction(async (q) => {
        const r = await q(
            `INSERT INTO fundraise_updates (campaign_id, event_id, update_type, created_by)
             VALUES (:campaignId, :meetingId, :type, :by)`,
            { campaignId, meetingId, type, by: user.id },
        );
        await setMeta('fundraise_updates', r.insertId, { body }, q);
        return r.insertId;
    });
    await audit(user.id, `fundraise.${type}.add`, 'fundraise', campaignId, { update: updateId, event: meetingId });
    await notifyMany(await fundraiseAudienceIds(campaignId), {
        type: 'fundraise.update',
        data: { title: campaign.title },
        link: campaignLink(campaignId, 'updates'),
        actorId: user.id,
    });
    refreshCampaign(campaignId);
    return { ok: true, message: meetingId ? 'fundraise.minutesSaved' : 'fundraise.updatePosted' };
}

/** Authors may delete their own post; managers any. */
export async function deleteUpdate(campaignId, updateId) {
    const { user, campaign, perms } = await authorize(campaignId, 'post');
    if (!campaign) return FORBIDDEN;
    const row = await queryOne(
        'SELECT created_by, update_type FROM fundraise_updates WHERE id = :updateId AND campaign_id = :campaignId',
        { updateId, campaignId },
    );
    if (!row || (!perms.manage && row.created_by !== user.id)) return FORBIDDEN;
    await query('DELETE FROM fundraise_updates WHERE id = :updateId AND campaign_id = :campaignId', { updateId, campaignId });
    await audit(user.id, `fundraise.${row.update_type}.delete`, 'fundraise', campaignId, { update: updateId });
    refreshCampaign(campaignId);
    return { ok: true, message: 'common.deleted' };
}
