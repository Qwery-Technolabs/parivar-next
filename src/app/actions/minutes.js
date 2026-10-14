'use server';
import { revalidatePath } from 'next/cache';
import { canManageFundraise, canModerateMinutes } from '@/lib/access';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { query, queryOne, setMeta } from '@/lib/db';
import { canSeeCampaign, getCampaign, listUpdates } from '@/lib/fundraise';

/**
 * One meeting's minutes, loaded when its "Minutes" button is opened (the meetings list carries only how many
 * there are). For anyone who can see the fundraise / Mandal.
 * Returns { ok, minutes: [{ id, body, author, author_local, canChange }] } — canChange: edit / delete it
 * (its author, or lib/access canModerateMinutes).
 */
export async function loadMeetingMinutes(campaignId, eventId) {
    const user = await getCurrentUser();
    const cid = Number(campaignId);
    const ev = Number(eventId);
    if (!user || !cid || !ev) return { error: 'common.forbidden' };
    const [campaign, visible] = await Promise.all([getCampaign(cid), canSeeCampaign(user, cid)]);
    if (!campaign || !visible) return { error: 'common.forbidden' };
    // Like the page: a draft is for those who can manage it.
    if (campaign.status === 'draft' && !(await canManageFundraise(user, campaign))) return { error: 'common.forbidden' };
    const [rows, moderate] = await Promise.all([listUpdates(cid, { eventId: ev }), canModerateMinutes(user, campaign)]);
    return {
        ok: true,
        minutes: rows
            .filter((u) => u.update_type === 'minutes')
            .map((u) => ({ id: u.id, body: u.body, author: u.author, author_local: u.author_local, canChange: moderate || u.created_by === user.id })),
    };
}

/** The minute and the caller, when the caller may edit / delete it; else null. */
async function minuteFor(campaignId, minuteId) {
    const user = await getCurrentUser();
    const cid = Number(campaignId);
    const mid = Number(minuteId);
    if (!user || !cid || !mid) return null;
    const [campaign, row] = await Promise.all([
        getCampaign(cid),
        queryOne(`SELECT id, created_by, event_id FROM fundraise_updates WHERE id = :mid AND campaign_id = :cid AND update_type = 'minutes'`, { mid, cid }),
    ]);
    if (!campaign || !row) return null;
    if (row.created_by !== user.id && !(await canModerateMinutes(user, campaign))) return null;
    return { user, campaign, row };
}

function refresh(campaignId) {
    revalidatePath(`/fundraise/${campaignId}`);
    revalidatePath(`/mandal/${campaignId}`);
}

/** Edit a meeting's minutes (FormDialog). Fields: campaign_id, minute_id, body. */
export async function editMinutes(prev, fd) {
    const found = await minuteFor(fd.get('campaign_id'), fd.get('minute_id'));
    if (!found) return { error: 'common.forbidden' };
    const body = String(fd.get('body') ?? '')
        .trim()
        .slice(0, 20000);
    if (!body) return { fieldErrors: { body: 'fundraise.errors.body' } };
    await setMeta('fundraise_updates', found.row.id, { body });
    await audit(found.user.id, 'fundraise.minutes.edit', 'fundraise', found.campaign.id, { update: found.row.id, event: found.row.event_id });
    refresh(found.campaign.id);
    return { ok: true, message: 'fundraise.minutesSaved' };
}

/** Delete a meeting's minutes. */
export async function deleteMinutes(campaignId, minuteId) {
    const found = await minuteFor(campaignId, minuteId);
    if (!found) return { error: 'common.forbidden' };
    await query('DELETE FROM fundraise_updates WHERE id = :id', { id: found.row.id });
    await audit(found.user.id, 'fundraise.minutes.delete', 'fundraise', found.campaign.id, { update: found.row.id, event: found.row.event_id });
    refresh(found.campaign.id);
    return { ok: true, message: 'common.deleted' };
}
