'use server';
import { randomBytes } from 'node:crypto';
import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { canCreateFundraiseIn, FUNDRAISE_TEAM_ROLES, fundraisePermissions } from '@/lib/access';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { bool, date, id, money, oneOf, str, strOrNull, time, todayIST } from '@/lib/forms';
import { CAMPAIGN_STATUSES, PAY_MODES } from '@/lib/fundraise';
import { fundraiseAudienceIds, notify, notifyMany } from '@/lib/notifications';
import { canManageAllFundraises } from '@/lib/roles';
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
        'SELECT id, group_id, title, title_gu, is_public, public_token FROM fundraise_campaigns WHERE id = :campaignId',
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

export async function saveCampaign(prev, fd) {
    const user = await getCurrentUser();
    if (!user) return FORBIDDEN;

    const campaignId = id(fd, 'id');
    const groupId = id(fd, 'group_id');
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
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    if (groupId) {
        const g = await queryOne('SELECT id FROM admin_groups WHERE id = :groupId', { groupId });
        if (!g) return { fieldErrors: { group_id: 'fundraise.errors.group' } };
    }

    const row = {
        groupId,
        title,
        titleGu: strOrNull(fd, 'title_gu', 200),
        target,
        start,
        end,
        status: oneOf(fd, 'status', CAMPAIGN_STATUSES, 'active'),
        location: strOrNull(fd, 'location', 100),
    };
    const meta = {
        description: str(fd, 'description', 20000),
        description_gu: str(fd, 'description_gu', 20000),
    };

    if (campaignId) {
        const { campaign } = await authorize(campaignId);
        if (!campaign) return FORBIDDEN;
        // Moving a fundraise into another group needs the right to create there too.
        if (groupId !== campaign.group_id && !(await canCreateFundraiseIn(user, groupId)))
            return { fieldErrors: { group_id: 'fundraise.errors.group' } };
        await withTransaction(async (q) => {
            await q(
                `UPDATE fundraise_campaigns
                    SET group_id = :groupId, title = :title, title_gu = :titleGu, location = :location, target_amount = :target,
                        start_date = :start, end_date = :end, status = :status
                  WHERE id = :campaignId`,
                { ...row, campaignId },
            );
            await setMeta('fundraise_campaigns', campaignId, meta, q);
        });
        await audit(user.id, 'fundraise.update', 'fundraise', campaignId, { title });
        refreshCampaign(campaignId);
        redirect(`/fundraise/${campaignId}`);
    }

    if (!(await canCreateFundraiseIn(user, groupId))) return { fieldErrors: { group_id: 'fundraise.errors.group' } };
    // The public switch on the create form defaults to the fundraise_settings.default_public value.
    const isPublic = bool(fd, 'is_public');
    const newId = await withTransaction(async (q) => {
        const r = await q(
            `INSERT INTO fundraise_campaigns (group_id, title, title_gu, location, target_amount, start_date, end_date, status, is_public, public_token, created_by)
             VALUES (:groupId, :title, :titleGu, :location, :target, :start, :end, :status, :isPublic, :token, :by)`,
            { ...row, isPublic: isPublic ? 1 : 0, token: isPublic ? newToken() : null, by: user.id },
        );
        await setMeta('fundraise_campaigns', r.insertId, meta, q);
        return r.insertId;
    });
    await audit(user.id, 'fundraise.create', 'fundraise', newId, { title });
    revalidatePath('/fundraise');
    redirect(`/fundraise/${newId}`);
}

export async function deleteCampaign(campaignId) {
    const user = await getCurrentUser();
    // Deleting wipes the ledger, so it is not delegated to group admins.
    if (!user || !canManageAllFundraises(user.role)) return FORBIDDEN;
    const c = await queryOne('SELECT id, title FROM fundraise_campaigns WHERE id = :campaignId', { campaignId });
    if (!c) return FORBIDDEN;
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

// ── contributions ─────────────────────────────────────────────────────────────

export async function addContribution(prev, fd) {
    const campaignId = id(fd, 'campaign_id');
    const { user, campaign } = await authorize(campaignId, 'contribution');
    if (!campaign) return FORBIDDEN;

    const userId = id(fd, 'user_id');
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
    if (amount == null) fieldErrors.amount = 'fundraise.errors.amount';
    if (!paidOn) fieldErrors.paid_on = 'fundraise.errors.date';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    const r = await query(
        `INSERT INTO fundraise_contributions
            (campaign_id, user_id, donor_name, amount, paid_on, mode, reference, is_anonymous, recorded_by)
         VALUES (:campaignId, :userId, :donorName, :amount, :paidOn, :mode, :reference, :anon, :by)`,
        {
            campaignId,
            userId: member?.id ?? null,
            donorName,
            amount,
            paidOn,
            mode: oneOf(fd, 'mode', PAY_MODES, 'cash'),
            reference: strOrNull(fd, 'reference', 100),
            // Forced off server-side when the setting disallows it — hiding the switch enforces nothing.
            anon: bool(fd, 'is_anonymous') && (await getSettings('fundraise')).allow_anonymous ? 1 : 0,
            by: user.id,
        },
    );
    await audit(user.id, 'fundraise.contribution.add', 'fundraise', campaignId, {
        contribution: r.insertId,
        donor: donorName,
        amount,
    });
    refreshCampaign(campaignId);
    return { ok: true, message: 'fundraise.contributionAdded' };
}

export async function deleteContribution(campaignId, contributionId) {
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;
    // campaign_id in the WHERE: a forged id from another campaign deletes nothing.
    const row = await queryOne(
        'SELECT donor_name, amount FROM fundraise_contributions WHERE id = :contributionId AND campaign_id = :campaignId',
        { contributionId, campaignId },
    );
    if (!row) return FORBIDDEN;
    await query('DELETE FROM fundraise_contributions WHERE id = :contributionId AND campaign_id = :campaignId', {
        contributionId,
        campaignId,
    });
    await audit(user.id, 'fundraise.contribution.delete', 'fundraise', campaignId, {
        contribution: contributionId,
        donor: row.donor_name,
        amount: row.amount,
    });
    refreshCampaign(campaignId);
    return { ok: true, message: 'common.deleted' };
}

// ── expenses ──────────────────────────────────────────────────────────────────

export async function addExpense(prev, fd) {
    const campaignId = id(fd, 'campaign_id');
    const { user, campaign } = await authorize(campaignId, 'expense');
    if (!campaign) return FORBIDDEN;

    const title = str(fd, 'title', 200);
    const amount = money(fd, 'amount');
    const spentOn = date(fd, 'spent_on');

    const fieldErrors = {};
    if (!title) fieldErrors.title = 'fundraise.errors.what';
    if (amount == null) fieldErrors.amount = 'fundraise.errors.amount';
    if (!spentOn) fieldErrors.spent_on = 'fundraise.errors.date';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    const expenseId = await withTransaction(async (q) => {
        const r = await q(
            `INSERT INTO fundraise_expenses (campaign_id, title, place, category, amount, spent_on, recorded_by)
             VALUES (:campaignId, :title, :place, :category, :amount, :spentOn, :by)`,
            {
                campaignId,
                title,
                place: strOrNull(fd, 'place', 200),
                category: strOrNull(fd, 'category', 64),
                amount,
                spentOn,
                by: user.id,
            },
        );
        await setMeta(
            'fundraise_expenses',
            r.insertId,
            { notes: str(fd, 'notes', 5000), bill_ref: str(fd, 'bill_ref', 100) },
            q,
        );
        return r.insertId;
    });
    await audit(user.id, 'fundraise.expense.add', 'fundraise', campaignId, { expense: expenseId, title, amount });
    refreshCampaign(campaignId);
    return { ok: true, message: 'fundraise.expenseAdded' };
}

export async function deleteExpense(campaignId, expenseId) {
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;
    const row = await queryOne(
        'SELECT title, amount FROM fundraise_expenses WHERE id = :expenseId AND campaign_id = :campaignId',
        { expenseId, campaignId },
    );
    if (!row) return FORBIDDEN;
    await query('DELETE FROM fundraise_expenses WHERE id = :expenseId AND campaign_id = :campaignId', {
        expenseId,
        campaignId,
    });
    await audit(user.id, 'fundraise.expense.delete', 'fundraise', campaignId, {
        expense: expenseId,
        title: row.title,
        amount: row.amount,
    });
    refreshCampaign(campaignId);
    return { ok: true, message: 'common.deleted' };
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
    await query('DELETE FROM fundraise_members WHERE campaign_id = :campaignId AND user_id = :userId', { campaignId, userId });
    await audit(user.id, 'fundraise.team.remove', 'fundraise', campaignId, { user: userId, role: row.member_role });
    refreshCampaign(campaignId);
    return { ok: true, message: 'fundraise.teamRemoved' };
}

// ── meetings ──────────────────────────────────────────────────────────────────

const MEETING_WORD = { en: 'Meeting', gu: 'મીટિંગ' };

/** Schedule (no meeting_id) or edit a meeting — an events_list row the calendar already shows. */
export async function saveMeeting(prev, fd) {
    const campaignId = id(fd, 'campaign_id');
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;

    const meetingId = id(fd, 'meeting_id');
    const day = date(fd, 'start_date');
    const rawTime = str(fd, 'start_time', 8);
    const at = time(fd, 'start_time');
    const fieldErrors = {};
    if (!day) fieldErrors.start_date = 'fundraise.errors.date';
    else if (!meetingId && day < todayIST()) fieldErrors.start_date = 'fundraise.errors.pastDate';
    if (rawTime && !at) fieldErrors.start_time = 'fundraise.errors.time';
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    const place = strOrNull(fd, 'location', 200);
    const agenda = str(fd, 'agenda', 20000);

    let eventId = meetingId;
    if (meetingId) {
        const existing = await queryOne(
            `SELECT id FROM events_list WHERE id = :meetingId AND campaign_id = :campaignId AND event_type = 'meeting'`,
            { meetingId, campaignId },
        );
        if (!existing) return FORBIDDEN;
        await withTransaction(async (q) => {
            await q(
                `UPDATE events_list SET start_date = :day, start_time = :at, location = :place
                  WHERE id = :meetingId AND campaign_id = :campaignId`,
                { day, at, place, meetingId, campaignId },
            );
            await setMeta('events_list', meetingId, { description: agenda }, q);
        });
    } else {
        eventId = await withTransaction(async (q) => {
            const r = await q(
                `INSERT INTO events_list (title, title_gu, event_type, start_date, start_time, location, group_id, campaign_id, created_by)
                 VALUES (:title, :titleGu, 'meeting', :day, :at, :place, :groupId, :campaignId, :by)`,
                {
                    title: `${campaign.title} — ${MEETING_WORD.en}`.slice(0, 200),
                    titleGu: `${campaign.title_gu || campaign.title} — ${MEETING_WORD.gu}`.slice(0, 200),
                    day,
                    at,
                    place,
                    groupId: campaign.group_id,
                    campaignId,
                    by: user.id,
                },
            );
            await setMeta('events_list', r.insertId, { description: agenda }, q);
            return r.insertId;
        });
    }

    await audit(user.id, meetingId ? 'fundraise.meeting.update' : 'fundraise.meeting.add', 'fundraise', campaignId, {
        event: eventId,
        date: day,
    });
    // A rescheduled meeting is notified too — a moved date is exactly what people need to hear.
    await notifyMany(await fundraiseAudienceIds(campaignId), {
        type: 'fundraise.meeting',
        data: { title: campaign.title, date: day, time: at, place },
        link: campaignLink(campaignId, 'meetings'),
        actorId: user.id,
    });
    refreshCampaign(campaignId);
    revalidatePath('/calendar');
    return { ok: true, message: meetingId ? 'fundraise.meetingUpdated' : 'fundraise.meetingScheduled' };
}

export async function cancelMeeting(campaignId, meetingId) {
    const { user, campaign } = await authorize(campaignId);
    if (!campaign) return FORBIDDEN;
    const row = await queryOne(
        `SELECT start_date FROM events_list WHERE id = :meetingId AND campaign_id = :campaignId AND event_type = 'meeting'`,
        { meetingId, campaignId },
    );
    if (!row) return FORBIDDEN;
    // Minutes already written survive as updates (fundraise_updates.event_id → SET NULL).
    await query('DELETE FROM events_list WHERE id = :meetingId AND campaign_id = :campaignId', { meetingId, campaignId });
    await audit(user.id, 'fundraise.meeting.cancel', 'fundraise', campaignId, { event: meetingId, date: row.start_date });
    refreshCampaign(campaignId);
    revalidatePath('/calendar');
    return { ok: true, message: 'fundraise.meetingCancelled' };
}

// ── updates & minutes ─────────────────────────────────────────────────────────

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
