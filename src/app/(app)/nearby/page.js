import { X } from 'lucide-react';
import Link from 'next/link';
import HomeFiltersDialog from '@/components/maps/home-filters-dialog';
import NearbyHomes from '@/components/maps/nearby-homes';
import PageHeader from '@/components/shell/page-header';
import PageMenu from '@/components/shell/page-menu';
import { requireUser } from '@/lib/auth';
import { homeFilterCount, homeOf, homesSummary, resolveHomeFilters } from '@/lib/homes';
import { homeFiltersHref } from '@/lib/home-filters';
import { getT } from '@/lib/i18n/server';
import { listCities, listVillages } from '@/lib/members';
import { listSurnames } from '@/lib/surnames';

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
 * ⋮ → Filters (in the URL): only my family tree, current city, native village, surname, age from – to. The count,
 * the opening box and every area request follow them; the active ones show as chips (× removes one) above the map.
 */
export default async function NearbyPage({ searchParams }) {
    const user = await requireUser();
    const sp = (await searchParams) ?? {};
    const asked = Number(sp.focus) || null;
    const filters = resolveHomeFilters(sp);
    const active = homeFilterCount(filters);
    const { t, locale } = await getT();
    const [summary, focusHome, myHome, cities, villages, surnames] = await Promise.all([
        homesSummary(filters, user.id),
        asked ? homeOf(asked, locale) : null,
        homeOf(user.id, locale, filters, user.id),
        listCities(),
        listVillages(),
        listSurnames(),
    ]);
    const start = focusHome ?? myHome;
    // Each active filter as a chip; × = the same URL without it.
    const age = filters.ageMin != null || filters.ageMax != null ? t('home.filters.ageChip', { from: filters.ageMin ?? 0, to: filters.ageMax ?? '∞' }) : null;
    const chips = [
        filters.family && { key: 'family', label: t('home.filters.family'), off: { family: false } },
        filters.city && { key: 'city', label: filters.city, off: { city: '' } },
        filters.village && { key: 'village', label: filters.village, off: { village: '' } },
        filters.surname && { key: 'surname', label: filters.surname, off: { surname: '' } },
        age && { key: 'age', label: age, off: { ageMin: null, ageMax: null } },
    ].filter(Boolean);
    return (
        <div>
            <PageHeader
                title={t('home.title')}
                subtitle={t('home.subtitle')}
                menu={
                    <PageMenu
                        items={[
                            { key: 'home-filters', label: active ? `${t('home.filters.title')} (${active})` : t('home.filters.title'), icon: 'filter' },
                            active > 0 && { key: 'home-filters-clear', label: t('home.filters.clear'), icon: 'x', href: '/nearby', group: 'clear' },
                        ]}
                    >
                        <HomeFiltersDialog
                            menuKey="home-filters"
                            filters={filters}
                            cities={cities}
                            villages={villages}
                            surnames={surnames.map((s) => s.name)}
                        />
                    </PageMenu>
                }
            />
            {chips.length > 0 && (
                <div className="mb-2 flex flex-wrap items-center gap-1.5">
                    {chips.map((c) => (
                        <Link
                            key={c.key}
                            href={homeFiltersHref({ ...filters, ...c.off })}
                            scroll={false}
                            className="inline-flex items-center gap-1 rounded-full bg-accent py-0.5 pr-1.5 pl-2.5 text-xs font-medium text-primary hover:bg-accent/70"
                        >
                            {c.label}
                            <X className="size-3 text-ink-gray" aria-label={t('common.remove')} />
                        </Link>
                    ))}
                </div>
            )}
            <NearbyHomes
                // New filters → a fresh map (nothing from the previous set stays on it).
                key={homeFiltersHref(filters)}
                count={summary.count}
                start={start ? { lat: start.lat, lng: start.lng, zoom: focusHome ? 16 : 14 } : null}
                bounds={start ? null : summary.bounds}
                seed={[focusHome, myHome].filter(Boolean)}
                focusId={focusHome?.id ?? null}
                meId={user.id}
                filters={active ? filters : null}
            />
        </div>
    );
}
