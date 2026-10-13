import NearbyHomes from '@/components/maps/nearby-homes';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { query } from '@/lib/db';
import { localized } from '@/lib/i18n/config';
import { getT } from '@/lib/i18n/server';
import { formatPhone } from '@/lib/phone';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('home.title') };
}

/**
 * Nearby Homes (Members section): the homes members pinned (users_listmeta home_lat / home_lng) on an
 * OpenStreetMap map — men's profiles only (never a woman's home), active members, for every signed-in member.
 */
export default async function NearbyPage({ searchParams }) {
    const user = await requireUser();
    const [{ t, locale }, rows] = await Promise.all([
        getT(),
        query(
            `SELECT u.id, u.full_name, u.full_name_local, u.village, u.city, u.phone, la.meta_value AS lat, ln.meta_value AS lng,
                    ad.meta_value AS address, av.meta_value AS added_via
               FROM users_list u
               JOIN users_listmeta la ON la.user_id = u.id AND la.meta_key = 'home_lat' AND la.meta_value <> ''
               JOIN users_listmeta ln ON ln.user_id = u.id AND ln.meta_key = 'home_lng' AND ln.meta_value <> ''
               LEFT JOIN users_listmeta ad ON ad.user_id = u.id AND ad.meta_key = 'address'
               LEFT JOIN users_listmeta av ON av.user_id = u.id AND av.meta_key = 'added_via'
              WHERE u.gender = 'male' AND u.status = 'active'
              ORDER BY u.full_name`,
        ),
    ]);
    const homes = rows
        .map((r) => ({
            id: r.id,
            name: localized(r, 'full_name', locale),
            village: r.village,
            city: r.city,
            address: r.address || '',
            // A relative added from a family tree keeps the phone for the family (as on the profile): not on the map.
            phone: r.added_via === 'family' || !r.phone ? null : { tel: r.phone, text: formatPhone(r.phone) },
            lat: Number(r.lat),
            lng: Number(r.lng),
        }))
        .filter((h) => Number.isFinite(h.lat) && Number.isFinite(h.lng));
    // ?focus=<id> (the Members list's pin button): open on that home.
    const asked = Number((await searchParams)?.focus) || null;
    const focusId = homes.some((h) => h.id === asked) ? asked : null;
    return (
        <div>
            <PageHeader title={t('home.title')} subtitle={t('home.subtitle')} />
            <NearbyHomes homes={homes} focusId={focusId} meId={user.id} />
        </div>
    );
}
