'use server';
import { canManageFundraise } from '@/lib/access';
import { getCurrentUser } from '@/lib/auth';
import { canSeeCampaign, getCampaign, listUpdates } from '@/lib/fundraise';

/**
 * One meeting's minutes, loaded when its "Minutes" button is opened (the meetings list carries only how many
 * there are). For anyone who can see the fundraise / Mandal. Returns { ok, minutes: [{ id, body, author, author_local }] }.
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
    const rows = await listUpdates(cid, { eventId: ev });
    return {
        ok: true,
        minutes: rows.filter((u) => u.update_type === 'minutes').map((u) => ({ id: u.id, body: u.body, author: u.author, author_local: u.author_local })),
    };
}
