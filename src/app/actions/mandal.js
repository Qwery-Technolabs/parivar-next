'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { getMeta, query, queryOne, setMeta, withTransaction } from '@/lib/db';
import { date as formatDate } from '@/lib/format';
import { date, id, str, strOrNull } from '@/lib/forms';
import { ensureInvitedUser } from '@/lib/invite';
import { canRunMandal, isFor, mandalMeetings } from '@/lib/mandal';
import { syncEveryoneMeetings } from '@/lib/meetings';
import { normalizePhone } from '@/lib/phone';

const FORBIDDEN = { error: 'common.forbidden' };

/** A Mandal payment in the fundraise history (same rows the ledger writes: entity 'contribution'). */
async function payHistory(q, campaignId, contributionId, action, actorId, before = null) {
    const [row] = await q(
        'SELECT id, user_id, donor_name, amount, paid_on, mode, reference, is_anonymous, deleted_at FROM fundraise_contributions WHERE id = :contributionId',
        { contributionId },
    );
    if (!row) return;
    const snap = { ...row, amount: Number(row.amount), is_anonymous: Number(row.is_anonymous) };
    await q(
        `INSERT INTO fundraise_history (campaign_id, entity, entity_id, action, actor_id, snapshot)
         VALUES (:campaignId, 'contribution', :contributionId, :action, :actorId, :snapshot)`,
        { campaignId, contributionId, action, actorId, snapshot: JSON.stringify(before ? { ...snap, before } : snap) },
    );
}
const MODES = ['cash', 'upi', 'bank', 'cheque', 'other'];

async function loadMandal(campaignId) {
    return queryOne("SELECT id, group_id, title, kind FROM fundraise_campaigns WHERE id = :campaignId AND kind = 'mandal'", { campaignId });
}
const refresh = (campaignId) => {
    revalidatePath(`/mandal/${campaignId}`);
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
    // Upcoming "everyone" meetings of the Mandal invite the new member too.
    await syncEveryoneMeetings({ scope: 'fundraise', scopeId: campaign.id });
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
 * whether they came, what they paid and how (present_<id> = '1', paid_<id> = amount, mode_<id> =
 * cash | upi | bank | cheque | other). Only the members this meeting is for. A payment is a
 * contribution row (that mode, on the meeting's date) so it shows in the ledger and totals; clearing
 * it removes that row again.
 */
export async function saveMandalMeeting(prev, fd) {
    const actor = await getCurrentUser();
    const campaign = await loadMandal(id(fd, 'campaign_id'));
    if (!actor || !campaign || !(await canRunMandal(actor, campaign))) return FORBIDDEN;
    const eventId = id(fd, 'event_id');
    const meeting = await queryOne("SELECT id, title, start_date FROM events_list WHERE id = :eventId AND event_type = 'meeting' AND campaign_id = :c", {
        eventId,
        c: campaign.id,
    });
    if (!meeting) return FORBIDDEN;
    if ((await getMeta('events_list', eventId)).archived === '1') return { error: 'mandal.errors.archived' };
    const existing = new Map(
        (await query('SELECT user_id, contribution_id FROM fundraise_mandal_marks WHERE event_id = :eventId', { eventId })).map((r) => [
            r.user_id,
            r.contribution_id,
        ]),
    );
    const target = (await mandalMeetings(campaign.id, 0)).find((e) => e.id === eventId);
    const members = (
        await query(`SELECT s.user_id, u.full_name FROM fundraise_subscribers s JOIN users_list u ON u.id = s.user_id WHERE s.campaign_id = :c`, {
            c: campaign.id,
        })
    ).filter((m) => !target || isFor(target, m.user_id) || existing.has(m.user_id));
    const fieldErrors = {};
    const rows = members.map((m) => {
        const raw = str(fd, `paid_${m.user_id}`, 12);
        const paid = raw ? Number(raw) : null;
        if (raw && (!Number.isFinite(paid) || paid < 0)) fieldErrors[`paid_${m.user_id}`] = 'mandal.errors.amount';
        const mode = MODES.includes(String(fd.get(`mode_${m.user_id}`))) ? String(fd.get(`mode_${m.user_id}`)) : 'cash';
        return { ...m, present: fd.get(`present_${m.user_id}`) === '1', paid: paid && paid > 0 ? Math.round(paid * 100) / 100 : null, mode };
    });
    if (Object.keys(fieldErrors).length) return { fieldErrors };
    // Who keeps this day's money: the schedule's money keeper (held_by), else whoever records it —
    // so the Savings tab's Holdings card can say who holds how much.
    const keeper = target?.holder?.id ?? actor.id;

    await withTransaction(async (q) => {
        for (const r of rows) {
            let contributionId = existing.get(r.user_id) ?? null;
            if (r.paid) {
                if (contributionId) {
                    const [old] = await q(
                        'SELECT donor_name, amount, paid_on, mode, reference, is_anonymous, deleted_at FROM fundraise_contributions WHERE id = :id',
                        { id: contributionId },
                    );
                    // A keeper set since (e.g. edited on the entry) stays; a missing one gets the schedule's.
                    await q(
                        'UPDATE fundraise_contributions SET amount = :amount, mode = :mode, paid_on = :day, kept_by = COALESCE(kept_by, :keeper), event_id = :ev, deleted_at = NULL, deleted_by = NULL WHERE id = :id',
                        { amount: r.paid, mode: r.mode, day: meeting.start_date, keeper, ev: eventId, id: contributionId },
                    );
                    if (old?.deleted_at) await payHistory(q, campaign.id, contributionId, 'add', actor.id);
                    else if (old && (Number(old.amount) !== r.paid || old.mode !== r.mode || String(old.paid_on) !== String(meeting.start_date)))
                        await payHistory(q, campaign.id, contributionId, 'edit', actor.id, {
                            ...old,
                            amount: Number(old.amount),
                            is_anonymous: Number(old.is_anonymous),
                        });
                } else {
                    const ins = await q(
                        `INSERT INTO fundraise_contributions (campaign_id, user_id, donor_name, amount, paid_on, mode, reference, recorded_by, kept_by, handed_over, event_id)
                         VALUES (:c, :u, :name, :amount, :day, :mode, :ref, :by, :keeper, 0, :ev)`,
                        {
                            c: campaign.id,
                            u: r.user_id,
                            name: r.full_name,
                            amount: r.paid,
                            mode: r.mode,
                            day: meeting.start_date,
                            ref: `Mandal ${meeting.start_date}`.slice(0, 100),
                            by: actor.id,
                            keeper,
                            ev: eventId,
                        },
                    );
                    contributionId = ins.insertId;
                    await payHistory(q, campaign.id, contributionId, 'add', actor.id);
                }
            } else if (contributionId) {
                const [was] = await q('SELECT deleted_at FROM fundraise_contributions WHERE id = :id', { id: contributionId });
                await q('UPDATE fundraise_contributions SET deleted_at = NOW(), deleted_by = :by WHERE id = :id', { by: actor.id, id: contributionId });
                if (was && !was.deleted_at) await payHistory(q, campaign.id, contributionId, 'delete', actor.id);
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
    await audit(actor.id, 'mandal.meeting.save', 'fundraise', campaign.id, {
        eventId,
        collect: Boolean(target?.collect),
        installment: target?.installment ?? 0,
        present: rows.filter((r) => r.present).length,
    });
    refresh(campaign.id);
    return { ok: true, message: 'mandal.sheetSaved' };
}

// ── schedules: one Mandal day each (a meeting of the Mandal) ─────────────────────────────

/**
 * New / edit a schedule: date, place, amount per person and who keeps the money. Saved as the
 * Mandal's meeting "<date> - Mandal" for everyone in it (members who join later are added too),
 * collecting that amount. Fields: campaign_id, event_id?, start_date, location, installment, held_by.
 */
export async function saveMandalSchedule(prev, fd) {
    const actor = await getCurrentUser();
    const campaign = await loadMandal(id(fd, 'campaign_id'));
    if (!actor || !campaign || !(await canRunMandal(actor, campaign))) return FORBIDDEN;
    const eventId = id(fd, 'event_id');
    const day = date(fd, 'start_date');
    const place = strOrNull(fd, 'location', 200);
    // Collect money this time? (default yes) — and how much per member — are set on the schedule.
    const collect = fd.get('collect') !== '0';
    const rawAmount = str(fd, 'installment', 12);
    const installment = rawAmount ? Number(rawAmount) : NaN;
    const heldBy = id(fd, 'held_by');
    const fieldErrors = {};
    if (!day) fieldErrors.start_date = 'meetings.errors.date';
    if (collect && (!Number.isFinite(installment) || installment <= 0)) fieldErrors.installment = 'mandal.errors.amount';
    if (heldBy && !(await queryOne('SELECT id FROM users_list WHERE id = :heldBy', { heldBy }))) fieldErrors.held_by = 'common.required';
    if (Object.keys(fieldErrors).length) return { fieldErrors };
    if (eventId) {
        const ev = await queryOne("SELECT id FROM events_list WHERE id = :eventId AND event_type = 'meeting' AND campaign_id = :c", {
            eventId,
            c: campaign.id,
        });
        if (!ev) return FORBIDDEN;
        if ((await getMeta('events_list', eventId)).archived === '1') return { error: 'mandal.errors.archived' };
    }
    const title = `${formatDate(day, 'en')} - Mandal`;
    const titleLocal = `${formatDate(day, 'gu')} - મંડળ`;
    const amount = collect ? String(Math.round(installment * 100) / 100) : '';
    const saved = await withTransaction(async (q) => {
        let evId = eventId;
        if (evId) {
            await q('UPDATE events_list SET title = :title, title_local = :titleLocal, start_date = :day, location = :place WHERE id = :evId', {
                title,
                titleLocal,
                day,
                place,
                evId,
            });
        } else {
            const r = await q(
                `INSERT INTO events_list (title, title_local, event_type, start_date, location, group_id, campaign_id, created_by)
                 VALUES (:title, :titleLocal, 'meeting', :day, :place, :groupId, :c, :by)`,
                { title, titleLocal, day, place, groupId: campaign.group_id, c: campaign.id, by: actor.id },
            );
            evId = r.insertId;
            await q('INSERT IGNORE INTO events_attendees (event_id, user_id) SELECT :evId, user_id FROM fundraise_subscribers WHERE campaign_id = :c', {
                evId,
                c: campaign.id,
            });
        }
        await setMeta(
            'events_list',
            evId,
            { collect: collect ? '1' : '0', installment: amount, held_by: heldBy ? String(heldBy) : '', ...(eventId ? {} : { audience: 'all' }) },
            q,
        );
        return evId;
    });
    await audit(actor.id, eventId ? 'mandal.schedule.update' : 'mandal.schedule.create', 'fundraise', campaign.id, { event: saved, day, installment: amount });
    refresh(campaign.id);
    return { ok: true, message: 'mandal.scheduleSaved' };
}

/** Delete a schedule added by mistake — only while no money was received at it. */
export async function deleteMandalSchedule(campaignId, eventId) {
    const actor = await getCurrentUser();
    const campaign = await loadMandal(Number(campaignId));
    if (!actor || !campaign || !(await canRunMandal(actor, campaign))) return FORBIDDEN;
    const ev = await queryOne("SELECT id, title FROM events_list WHERE id = :eventId AND event_type = 'meeting' AND campaign_id = :c", {
        eventId: Number(eventId),
        c: campaign.id,
    });
    if (!ev) return FORBIDDEN;
    const got = await queryOne('SELECT COALESCE(SUM(paid), 0) AS s FROM fundraise_mandal_marks WHERE event_id = :id', { id: ev.id });
    if (Number(got.s) > 0) return { error: 'mandal.errors.hasMoney' };
    await query('DELETE FROM events_list WHERE id = :id', { id: ev.id });
    await audit(actor.id, 'mandal.schedule.delete', 'fundraise', campaign.id, { event: ev.id, title: ev.title });
    refresh(campaign.id);
    return { ok: true, message: 'common.deleted' };
}

/** Archive a schedule whose money is in (closed: no more changes), or bring it back. */
export async function setMandalScheduleArchived(campaignId, eventId, archived) {
    const actor = await getCurrentUser();
    const campaign = await loadMandal(Number(campaignId));
    if (!actor || !campaign || !(await canRunMandal(actor, campaign))) return FORBIDDEN;
    const ev = await queryOne("SELECT id FROM events_list WHERE id = :eventId AND event_type = 'meeting' AND campaign_id = :c", {
        eventId: Number(eventId),
        c: campaign.id,
    });
    if (!ev) return FORBIDDEN;
    await setMeta('events_list', ev.id, { archived: archived ? '1' : '' });
    await audit(actor.id, archived ? 'mandal.schedule.archive' : 'mandal.schedule.restore', 'fundraise', campaign.id, { event: ev.id });
    refresh(campaign.id);
    return { ok: true, message: archived ? 'mandal.scheduleArchived' : 'mandal.scheduleRestored' };
}
