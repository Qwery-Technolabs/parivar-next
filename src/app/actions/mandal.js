'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { id, str } from '@/lib/forms';
import { ensureInvitedUser } from '@/lib/invite';
import { canRunMandal } from '@/lib/mandal';
import { normalizePhone } from '@/lib/phone';

const FORBIDDEN = { error: 'common.forbidden' };

async function loadMandal(campaignId) {
    return queryOne("SELECT id, group_id, title, kind FROM fundraise_campaigns WHERE id = :campaignId AND kind = 'mandal'", { campaignId });
}
const refresh = (campaignId) => {
    revalidatePath(`/fundraise/${campaignId}`);
    revalidatePath('/fundraise');
};

/** Add a member to a Mandal: someone in the app (member) or a phone number (invited). */
export async function addMandalMember(prev, fd) {
    const actor = await getCurrentUser();
    const campaign = await loadMandal(id(fd, 'campaign_id'));
    if (!actor || !campaign || !(await canRunMandal(actor, campaign))) return FORBIDDEN;
    let userId;
    if (fd.get('mode') === 'phone') {
        const phone = normalizePhone(fd.get('phone'));
        if (!phone) return { fieldErrors: { phone: 'auth.errors.phoneInvalid' } };
        const invited = await ensureInvitedUser(actor, phone, str(fd, 'full_name', 150));
        if (invited.error) return { fieldErrors: { phone: invited.error } };
        userId = invited.id;
    } else {
        userId = id(fd, 'user_id');
        if (!userId || !(await queryOne('SELECT id FROM users_list WHERE id = :userId', { userId }))) return { fieldErrors: { user_id: 'common.required' } };
    }
    await query('INSERT IGNORE INTO fundraise_subscribers (campaign_id, user_id, added_by) VALUES (:c, :u, :by)', { c: campaign.id, u: userId, by: actor.id });
    await audit(actor.id, 'mandal.member.add', 'fundraise', campaign.id, { userId });
    refresh(campaign.id);
    return { ok: true, message: 'mandal.memberAdded' };
}

/** Take someone out of a Mandal (their past payments stay in the ledger). */
export async function removeMandalMember(campaignId, userId) {
    const actor = await getCurrentUser();
    const campaign = await loadMandal(Number(campaignId));
    if (!actor || !campaign || !(await canRunMandal(actor, campaign))) return FORBIDDEN;
    await query('DELETE FROM fundraise_subscribers WHERE campaign_id = :c AND user_id = :u', { c: campaign.id, u: Number(userId) });
    await audit(actor.id, 'mandal.member.remove', 'fundraise', campaign.id, { userId: Number(userId) });
    refresh(campaign.id);
    return { ok: true, message: 'mandal.memberRemoved' };
}

/**
 * One Mandal meeting's sheet: collect money this time (yes / no), the amount, and per member
 * whether they came and what they paid (present_<id> = '1', paid_<id> = amount). A payment is a
 * contribution row (cash, on the meeting's date) so it shows in the ledger and totals; clearing
 * it removes that row again.
 */
export async function saveMandalMeeting(prev, fd) {
    const actor = await getCurrentUser();
    const campaign = await loadMandal(id(fd, 'campaign_id'));
    if (!actor || !campaign || !(await canRunMandal(actor, campaign))) return FORBIDDEN;
    const eventId = id(fd, 'event_id');
    const meeting = await queryOne(
        "SELECT id, title, start_date FROM events_list WHERE id = :eventId AND event_type = 'meeting' AND campaign_id = :c",
        { eventId, c: campaign.id },
    );
    if (!meeting) return FORBIDDEN;
    const collect = fd.get('collect') === '1';
    const rawAmount = str(fd, 'installment', 12);
    const installment = rawAmount ? Number(rawAmount) : 0;
    if (collect && (!Number.isFinite(installment) || installment <= 0)) return { fieldErrors: { installment: 'mandal.errors.amount' } };
    const members = await query(
        `SELECT s.user_id, u.full_name FROM fundraise_subscribers s JOIN users_list u ON u.id = s.user_id WHERE s.campaign_id = :c`,
        { c: campaign.id },
    );
    const existing = new Map(
        (await query('SELECT user_id, contribution_id FROM fundraise_mandal_marks WHERE event_id = :eventId', { eventId })).map((r) => [r.user_id, r.contribution_id]),
    );
    const fieldErrors = {};
    const rows = members.map((m) => {
        const raw = str(fd, `paid_${m.user_id}`, 12);
        const paid = raw ? Number(raw) : null;
        if (raw && (!Number.isFinite(paid) || paid < 0)) fieldErrors[`paid_${m.user_id}`] = 'mandal.errors.amount';
        return { ...m, present: fd.get(`present_${m.user_id}`) === '1', paid: paid && paid > 0 ? Math.round(paid * 100) / 100 : null };
    });
    if (Object.keys(fieldErrors).length) return { fieldErrors };

    await withTransaction(async (q) => {
        await setMeta('events_list', eventId, { collect: collect ? '1' : '0', installment: collect ? String(installment) : '' }, q);
        for (const r of rows) {
            let contributionId = existing.get(r.user_id) ?? null;
            if (r.paid) {
                if (contributionId) {
                    await q('UPDATE fundraise_contributions SET amount = :amount, paid_on = :day, deleted_at = NULL, deleted_by = NULL WHERE id = :id', {
                        amount: r.paid,
                        day: meeting.start_date,
                        id: contributionId,
                    });
                } else {
                    const ins = await q(
                        `INSERT INTO fundraise_contributions (campaign_id, user_id, donor_name, amount, paid_on, mode, reference, recorded_by)
                         VALUES (:c, :u, :name, :amount, :day, 'cash', :ref, :by)`,
                        { c: campaign.id, u: r.user_id, name: r.full_name, amount: r.paid, day: meeting.start_date, ref: `Mandal ${meeting.start_date}`.slice(0, 100), by: actor.id },
                    );
                    contributionId = ins.insertId;
                }
            } else if (contributionId) {
                await q('UPDATE fundraise_contributions SET deleted_at = NOW(), deleted_by = :by WHERE id = :id', { by: actor.id, id: contributionId });
                contributionId = null;
            }
            await q(
                `INSERT INTO fundraise_mandal_marks (event_id, user_id, campaign_id, present, paid, contribution_id, marked_by)
                 VALUES (:e, :u, :c, :present, :paid, :cid, :by)
                 ON DUPLICATE KEY UPDATE present = VALUES(present), paid = VALUES(paid), contribution_id = VALUES(contribution_id), marked_by = VALUES(marked_by)`,
                { e: eventId, u: r.user_id, c: campaign.id, present: r.present ? 1 : 0, paid: r.paid, cid: contributionId, by: actor.id },
            );
        }
    });
    await audit(actor.id, 'mandal.meeting.save', 'fundraise', campaign.id, { eventId, collect, installment, present: rows.filter((r) => r.present).length });
    refresh(campaign.id);
    return { ok: true, message: 'mandal.sheetSaved' };
}
