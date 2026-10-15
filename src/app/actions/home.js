'use server';
import { revalidatePath } from 'next/cache';
import { audit } from '@/lib/audit';
import { getCurrentUser } from '@/lib/auth';
import { queryOne, setMeta } from '@/lib/db';
import { AREA_LIMIT, homesInArea } from '@/lib/homes';
import { getT } from '@/lib/i18n/server';
import { canEditUser } from '@/lib/roles';

/**
 * A member's home pin (users_listmeta home_lat / home_lng) — set from the address on the member edit page.
 * Whoever may edit the profile. Empty lat / lng removes it. Only men's homes appear on Nearby Homes.
 */
export async function setHomeLocation(userId, lat, lng) {
    const actor = await getCurrentUser();
    const uid = Number(userId);
    if (!actor || !uid) return { error: 'common.forbidden' };
    const target = await queryOne(
        `SELECT id, role, status, created_by, last_login_at,
                (SELECT meta_value FROM users_listmeta WHERE user_id = users_list.id AND meta_key = 'added_via') AS added_via
           FROM users_list WHERE id = :uid`,
        { uid },
    );
    if (!target || !canEditUser(actor, target)) return { error: 'common.forbidden' };
    const clear = lat === null || lat === '' || lng === null || lng === '';
    const la = Number(lat);
    const ln = Number(lng);
    if (!clear && (!Number.isFinite(la) || !Number.isFinite(ln) || Math.abs(la) > 90 || Math.abs(ln) > 180)) return { error: 'home.errors.invalid' };
    await setMeta('users_list', uid, clear ? { home_lat: '', home_lng: '' } : { home_lat: la.toFixed(6), home_lng: ln.toFixed(6) });
    await audit(actor.id, clear ? 'user.home.clear' : 'user.home.set', 'user', uid, {});
    revalidatePath(`/members/${uid}`);
    revalidatePath('/nearby');
    return { ok: true, message: clear ? 'home.cleared' : 'home.saved' };
}

/**
 * Nearby Homes: the homes inside the box on screen { s, w, n, e } (the map asks as it is moved / zoomed; the client
 * pads the box and keeps answers, so small moves ask nothing). Any signed-in member.
 * Returns { ok, homes, full } — full: the area held more than AREA_LIMIT (zooming in loads the rest).
 */
export async function loadHomesInArea(box) {
    const user = await getCurrentUser();
    if (!user) return { error: 'common.forbidden' };
    const num = (v, max) => Math.max(-max, Math.min(max, Number(v)));
    const b = { s: num(box?.s, 90), n: num(box?.n, 90), w: num(box?.w, 180), e: num(box?.e, 180) };
    if (![b.s, b.n, b.w, b.e].every(Number.isFinite) || b.s > b.n || b.w > b.e) return { error: 'common.error' };
    const { locale } = await getT();
    const homes = await homesInArea(b, locale);
    return { ok: true, homes, full: homes.length >= AREA_LIMIT };
}
