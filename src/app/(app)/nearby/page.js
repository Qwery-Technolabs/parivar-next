import NearbyHomes from '@/components/maps/nearby-homes';
import PageHeader from '@/components/shell/page-header';
import { requireUser } from '@/lib/auth';
import { homeOf, homesSummary } from '@/lib/homes';
import { getT } from '@/lib/i18n/server';

export async function generateMetadata() {
    const { t } = await getT();
    return { title: t('home.title') };
}

/**
 * Nearby Homes (Members section): the homes members pinned (users_listmeta home_lat / home_lng) on an
 * OpenStreetMap map — men's profiles only (never a woman's home), active members, for every signed-in member.
 * The page carries only how many there are and where to open: the focused home (?focus=<id>, the Members list's
 * pin button), else my own home, else the box around them all. The homes themselves load by the area on screen
 * (actions/home.js loadHomesInArea) as the map moves.
 */
export default async function NearbyPage({ searchParams }) {
    const user = await requireUser();
    const asked = Number((await searchParams)?.focus) || null;
    const { t, locale } = await getT();
    const [summary, focusHome, myHome] = await Promise.all([homesSummary(), asked ? homeOf(asked, locale) : null, homeOf(user.id, locale)]);
    const start = focusHome ?? myHome;
    return (
        <div>
            <PageHeader title={t('home.title')} subtitle={t('home.subtitle')} />
            <NearbyHomes
                count={summary.count}
                start={start ? { lat: start.lat, lng: start.lng, zoom: focusHome ? 16 : 14 } : null}
                bounds={start ? null : summary.bounds}
                seed={[focusHome, myHome].filter(Boolean)}
                focusId={focusHome?.id ?? null}
                meId={user.id}
            />
        </div>
    );
}
