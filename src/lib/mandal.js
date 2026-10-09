import 'server-only';
import { fundraisePermissions } from './access';
import { getMeta, getMetaMany, inList, query } from './db';
import { listContributions, listExpenses } from './fundraise';
import { date as formatDate } from './format';

// Mandal (savings circle) — a fundraise of kind 'mandal' inside a group. Its members
// (fundraise_subscribers) pay a fixed amount at its meetings (the fundraise's own meetings).
// Per meeting (events_listmeta): collect '1' | '0' (default '1') and installment (default: the
// Mandal's, fundraise_campaignsmeta.installment). Per meeting and member
// (fundraise_mandal_marks): present, paid, and the fundraise_contributions row of that payment —
// so totals, the ledger and print include Mandal money. Dues = installments of the collecting
// meetings held since they joined − what they paid; missed = absent marks since they last came.

/**
 * May `user` run this Mandal (add / remove members, mark attendance and payments)? Admins and
 * sub-admins (app-level, the fundraise's admins, admins / sub-admins of its groups) and its
 * Treasurer and Collector — not plain members.
 */
export async function canRunMandal(user, campaign) {
    if (!user || !campaign) return false;
    const perms = await fundraisePermissions(user, campaign);
    // Its own people only — app admins / sub-admins, its team admins, treasurers and collectors. A group
    // admin / sub-admin with no role in the Mandal only views it (no + Contribution, sheet Edit, members, schedules).
    return perms.manage || perms.teamRoles.includes('treasurer') || perms.teamRoles.includes('collector');
}

/**
 * The Mandal's schedules (its meetings — one per Mandal day, "21 Oct 2026 - Mandal"), newest first, with whether money is collected and how much, and who it is
 * for: everyone (audience 'all', or older meetings without one) or the chosen members (`invited`),
 * archived (money in, closed: no more changes) and who holds its money (`holder`).
 */
export async function mandalMeetings(campaignId, defaultInstallment) {
    const rows = await query(
        `SELECT id, title, title_local, start_date, start_time, location FROM events_list
          WHERE event_type = 'meeting' AND campaign_id = :campaignId ORDER BY start_date DESC, start_time DESC LIMIT 100`,
        { campaignId },
    );
    const meta = await getMetaMany(
        'events_list',
        rows.map((r) => r.id),
        ['collect', 'installment', 'audience', 'archived', 'held_by', 'handed_over'],
    );
    // Who keeps the money collected at each schedule (events_listmeta held_by = a user id).
    const holderIds = [...new Set(rows.map((r) => Number(meta[r.id]?.held_by) || 0).filter(Boolean))];
    const holders = holderIds.length
        ? new Map(
              (
                  await (async () => {
                      const l = inList(holderIds, 'h');
                      return query(`SELECT id, full_name, full_name_local FROM users_list WHERE id IN (${l.sql})`, l.params);
                  })()
              ).map((u) => [u.id, u]),
          )
        : new Map();
    const chosen = rows.filter((r) => meta[r.id]?.audience === 'selected').map((r) => r.id);
    const att = chosen.length
        ? await (async () => {
              const l = inList(chosen, 'ev');
              return query(`SELECT event_id, user_id FROM events_attendees WHERE event_id IN (${l.sql})`, l.params);
          })()
        : [];
    return rows.map((r) => ({
        ...r,
        everyone: meta[r.id]?.audience !== 'selected',
        archived: meta[r.id]?.archived === '1',
        holder: holders.get(Number(meta[r.id]?.held_by)) ?? null,
        // Its money has been handed to the treasurer (set on the schedule; applies to all its payments).
        handedOver: meta[r.id]?.handed_over === '1',
        invited: att.filter((a) => a.event_id === r.id).map((a) => a.user_id),
        collect: (meta[r.id]?.collect ?? '1') === '1',
        installment: Number(meta[r.id]?.installment ?? defaultInstallment ?? 0) || 0,
    }));
}

/**
 * Members with what they owe and how long they have been away.
 * @returns {Promise<Array<{ id, full_name, full_name_local, phone, joined, due: number, paid: number, missed: number, daysAway: number|null, lastPresent: string|null }>>}
 */
export async function mandalMembers(campaignId, meetings, today) {
    const members = await query(
        `SELECT u.id, u.full_name, u.full_name_local, u.phone, DATE(s.created_at) AS joined
           FROM fundraise_subscribers s JOIN users_list u ON u.id = s.user_id
          WHERE s.campaign_id = :campaignId ORDER BY u.full_name`,
        { campaignId },
    );
    if (!members.length) return [];
    const marks = await query('SELECT event_id, user_id, present, paid FROM fundraise_mandal_marks WHERE campaign_id = :campaignId', { campaignId });
    const held = meetings.filter((m) => m.start_date <= today).sort((a, b) => a.start_date.localeCompare(b.start_date));
    const day = (d) => Math.round((Date.parse(today) - Date.parse(d)) / 86400000);
    return members.map((m) => {
        const mine = new Map(marks.filter((x) => x.user_id === m.id).map((x) => [x.event_id, x]));
        // Count from the meeting they joined at (or the first meeting, if they joined before it) —
        // only meetings they were asked to (everyone, or chosen), or ones they were marked at.
        const theirs = held.filter((e) => (e.start_date >= m.joined && isFor(e, m.id)) || mine.has(e.id));
        const owed = theirs.filter((e) => e.collect).reduce((s, e) => s + e.installment, 0);
        const paid = [...mine.values()].reduce((s, x) => s + Number(x.paid || 0), 0);
        // Missed in a row: their meetings since the last one they came to. Nothing recorded = absent.
        let missed = 0;
        let lastPresent = null;
        for (const e of [...theirs].reverse()) {
            if (mine.get(e.id)?.present) {
                lastPresent = e.start_date;
                break;
            }
            missed++;
        }
        return {
            ...m,
            due: Math.max(0, Math.round((owed - paid) * 100) / 100),
            paid,
            missed,
            lastPresent,
            daysAway: missed ? day(lastPresent ?? theirs[0]?.start_date ?? m.joined) : null,
        };
    });
}

/** Is this meeting for this member: everyone's, or they were chosen? */
export function isFor(meeting, userId) {
    return meeting.everyone || meeting.invited.includes(userId);
}

/** Marks of one meeting: user_id → { present, paid }. */
export async function meetingMarks(eventId) {
    const rows = await query('SELECT user_id, present, paid FROM fundraise_mandal_marks WHERE event_id = :eventId', { eventId });
    return Object.fromEntries(
        rows.map((r) => [
            r.user_id,
            {
                present: Boolean(r.present),
                paid: r.paid == null ? null : Number(r.paid),
            },
        ]),
    );
}

/** Pending for each member BEFORE this meeting (what they still owe from earlier ones). */
export function pendingBefore(members, meetings, marksByMeeting, eventId) {
    const target = meetings.find((m) => m.id === eventId);
    if (!target) return {};
    const earlier = meetings.filter((m) => m.collect && m.start_date < target.start_date);
    const out = {};
    for (const mem of members) {
        const owed = earlier
            .filter((e) => (e.start_date >= mem.joined && isFor(e, mem.id)) || marksByMeeting[e.id]?.[mem.id])
            .reduce((s, e) => s + e.installment, 0);
        const paid = earlier.reduce((s, e) => s + Number(marksByMeeting[e.id]?.[mem.id]?.paid || 0), 0);
        out[mem.id] = Math.max(0, Math.round((owed - paid) * 100) / 100);
    }
    return out;
}

/**
 * What one member still owes, schedule by schedule, oldest first: everything they paid at these
 * schedules clears the oldest dues first (a missed month paid later is no longer pending).
 * `before` (a date): only schedules before it — the sheet of that meeting; else `upTo` (today): held ones.
 * @returns {Array<{ id: number, date: string, amount: number }>}
 */
export function unpaidBySchedule(member, meetings, marksByMeeting, { before = null, upTo = null } = {}) {
    const theirs = meetings
        .filter((e) => (before ? e.start_date < before : !upTo || e.start_date <= upTo))
        .filter((e) => e.collect && ((e.start_date >= member.joined && isFor(e, member.id)) || marksByMeeting[e.id]?.[member.id]))
        .sort((a, b) => a.start_date.localeCompare(b.start_date));
    let paid = theirs.reduce((s, e) => s + Number(marksByMeeting[e.id]?.[member.id]?.paid || 0), 0);
    const out = [];
    for (const e of theirs) {
        const take = Math.min(paid, e.installment);
        paid -= take;
        const left = Math.round((e.installment - take) * 100) / 100;
        if (left > 0) out.push({ id: e.id, date: e.start_date, amount: left });
    }
    return out;
}

/** All marks of a Mandal, by meeting: eventId → userId → { present, paid, mode } (mode of the payment's contribution). */
export async function allMarks(campaignId) {
    const rows = await query(
        `SELECT m.event_id, m.user_id, m.present, m.paid, fc.mode
           FROM fundraise_mandal_marks m LEFT JOIN fundraise_contributions fc ON fc.id = m.contribution_id AND fc.deleted_at IS NULL
          WHERE m.campaign_id = :campaignId`,
        { campaignId },
    );
    const out = {};
    for (const r of rows)
        (out[r.event_id] ??= {})[r.user_id] = {
            present: Boolean(r.present),
            paid: r.paid == null ? null : Number(r.paid),
            mode: r.mode ?? null,
        };
    return out;
}

/**
 * Who a Mandal is for (meta members_mode): 'all' = everyone in its group — also people who join the
 * group later — or 'selected' = the chosen people (the default for older Mandals).
 * Adds group members who are not in yet; runs before the Mandal's members are read.
 */
export async function syncMandalMembers(campaign) {
    if (campaign?.kind !== 'mandal' || !campaign.group_id) return;
    const mode = campaign.meta?.members_mode ?? (await getMeta('fundraise_campaigns', campaign.id)).members_mode;
    if (mode !== 'all') return;
    await query(
        `INSERT IGNORE INTO fundraise_subscribers (campaign_id, user_id, added_by)
         SELECT :c, gm.user_id, NULL FROM admin_group_members gm WHERE gm.group_id = :g`,
        { c: campaign.id, g: campaign.group_id },
    );
}

/** For the Mandal form: the group's people (+ anyone already in it) and who is in it now. */
export async function mandalChoice(groupId, campaignId = null) {
    const rows = await query(
        `SELECT u.id, u.full_name, u.full_name_local FROM users_list u
          WHERE u.status = 'active' AND (u.id IN (SELECT user_id FROM admin_group_members WHERE group_id = :g)
             OR u.id IN (SELECT user_id FROM fundraise_subscribers WHERE campaign_id = :c))
          ORDER BY u.full_name`,
        { g: groupId ?? 0, c: campaignId ?? 0 },
    );
    const memberIds = campaignId ? await subscriberIds(campaignId) : null;
    return { people: rows, memberIds };
}

/** Ids of members, for pickers. */
export async function subscriberIds(campaignId) {
    const l = inList([campaignId], 's');
    return (await query(`SELECT user_id FROM fundraise_subscribers WHERE campaign_id IN (${l.sql})`, l.params)).map((r) => r.user_id);
}

/**
 * The public ledger of a Mandal (the /p/[token] page and its print): its schedules for the filter,
 * and the received income + expenses — all, ONE schedule (`schedule` = events_list id: that day's
 * sheet payments + expenses named for it), or a date range (`from` / `to`, YYYY-MM-DD, either end
 * open). Newest first; the page groups them by date.
 */
export async function mandalLedger(campaignId, { schedule = null, from = '', to = '' } = {}) {
    const [schedules, incomeAll, expenseAll] = await Promise.all([
        query("SELECT id, start_date, location FROM events_list WHERE campaign_id = :c AND event_type = 'meeting' ORDER BY start_date DESC, id DESC", {
            c: campaignId,
        }),
        listContributions(campaignId),
        listExpenses(campaignId),
    ]);
    const received = incomeAll.filter((r) => r.mode !== 'unpaid');
    const day = (v) => String(v ?? '').slice(0, 10);
    const chosen = schedule ? schedules.find((s) => s.id === schedule) : null;
    if (chosen) {
        return {
            schedules,
            schedule: chosen.id,
            incomes: received.filter((r) => r.event_id === chosen.id),
            expenses: expenseAll.filter((x) => x.event_id === chosen.id),
        };
    }
    const inRange = (d) => (!from || day(d) >= from) && (!to || day(d) <= to);
    return {
        schedules,
        schedule: null,
        incomes: received.filter((r) => inRange(r.paid_on)),
        expenses: expenseAll.filter((x) => inRange(x.spent_on)),
    };
}

/**
 * The statement tables of a filtered Mandal ledger (public page / its print): contributions and
 * expenses as filtered, "by contributor" rebuilt from them (anonymous gifts folded into one row,
 * as on any public page), and the campaign with collected / spent of THIS selection.
 */
export function mandalStatement(campaign, ledger) {
    const byKey = new Map();
    for (const r of ledger.incomes) {
        const k = r.is_anonymous ? 'anon' : r.user_id ? `u${r.user_id}` : `n${r.donor_name}`;
        const c = byKey.get(k) ?? {
            k,
            donor_name: r.donor_name,
            donor_name_local: r.is_anonymous ? null : (r.donor_name_local ?? null),
            user_id: r.user_id,
            is_anonymous: r.is_anonymous,
            total: 0,
            paid_entries: 0,
            entries: 0,
        };
        c.total += Number(r.amount);
        c.paid_entries += 1;
        c.entries += 1;
        byKey.set(k, c);
    }
    const contributors = [...byKey.values()].sort((a, b) => b.total - a.total || String(a.donor_name).localeCompare(String(b.donor_name)));
    const collected = ledger.incomes.reduce((s, r) => s + Number(r.amount), 0);
    const spent = ledger.expenses.reduce((s, x) => s + Number(x.amount), 0);
    return {
        contributors,
        contributions: ledger.incomes,
        expenses: ledger.expenses,
        shownCampaign: { ...campaign, collected, spent },
    };
}

/** The filter in words, for the printout's sub-title: a schedule, a date range, or '' for all. */
export function mandalPeriod(ledger, filters, t, locale) {
    const chosen = filters.schedule ? ledger.schedules.find((s) => s.id === filters.schedule) : null;
    if (chosen) return `${formatDate(chosen.start_date, locale)} - ${t('mandal.word')}`;
    if (filters.from || filters.to) return `${filters.from ? formatDate(filters.from, locale) : '…'} – ${filters.to ? formatDate(filters.to, locale) : '…'}`;
    return '';
}
