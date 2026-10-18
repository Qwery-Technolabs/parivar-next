'use client';
import { Crosshair, List, Loader2, Navigation, Phone, User, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useEffect, useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { loadHomesInArea } from '@/app/actions/home';
import { LinkIconSpinner } from '@/components/ui/link-spinner';
import useFillHeight from '@/components/ui/use-fill-height';
import { fetchCached } from '@/lib/client-cache';
import { useT } from '@/lib/i18n/client';

const OsmMap = dynamic(() => import('./osm-map'), {
    ssr: false,
    loading: () => (
        <div className="flex h-full min-h-80 items-center justify-center rounded-lg border border-surface-border bg-white">
            <Loader2 className="size-5 animate-spin text-ink-gray" />
        </div>
    ),
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The card a pin opens: a person icon, the name, village · city, address, phone, then icon-only Profile (navy),
 * Directions (light blue) and Call (light green).
 * Leaflet's popup sets its own font (Helvetica/Arial), which made this read heavy — so the card uses the app's
 * font (Geist + the Gujarati/Devanagari fallbacks; --font-sans itself is @theme inline, not a real var) and lighter weights: name 600, buttons 500, place 400.
 */
// Lucide icon paths for the popup's icon buttons (the popup is HTML, not React).
const ICONS = {
    user: '<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
    nav: '<polygon points="3 11 22 2 13 21 11 13 3 11"/>',
    phone: '<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
    pin: '<path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/>',
};
const svg = (k, size = 16) =>
    `<svg viewBox="0 0 24 24" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true" style="flex:none">${ICONS[k]}</svg>`;

/**
 * A home's popup: name, village · city, the address (up to 3 lines) and phone, then icon-only actions —
 * profile, directions (Google Maps), call.
 */
function miniProfile(h, t) {
    const place = [h.village, h.city].filter(Boolean).join(' · ');
    const icon = 'display:inline-flex;align-items:center;justify-content:center;width:32px;height:32px;border-radius:8px;text-decoration:none';
    const line = 'display:flex;gap:6px;align-items:flex-start;margin-top:6px;color:#334155;font-size:12px;line-height:1.4';
    return `<div style="font-family:var(--font-geist-sans),var(--font-gujarati),var(--font-devanagari),system-ui,sans-serif;font-weight:400;max-width:250px">
<div style="display:flex;gap:10px;align-items:center;min-width:200px">
  <span style="display:flex;width:36px;height:36px;flex:none;align-items:center;justify-content:center;border-radius:50%;background:#172f56">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/></svg>
  </span>
  <span style="min-width:0"><span style="display:block;color:#172f56;font-size:13px;font-weight:600">${esc(h.name)}</span>${place ? `<span style="color:#5b6b85;font-size:12px;font-weight:400">${esc(place)}</span>` : ''}</span>
</div>
${h.address ? `<div style="${line}"><span style="color:#5b6b85;margin-top:1px">${svg('pin', 13)}</span><span style="display:-webkit-box;-webkit-line-clamp:3;-webkit-box-orient:vertical;overflow:hidden">${esc(h.address)}</span></div>` : ''}
${h.phone ? `<div style="${line}"><span style="color:#5b6b85;margin-top:1px">${svg('phone', 13)}</span><a href="tel:${esc(h.phone.tel)}" style="color:#172f56;font-variant-numeric:tabular-nums;text-decoration:none">${esc(h.phone.text)}</a></div>` : ''}
<div style="display:flex;gap:6px;margin-top:10px">
  <a href="/members/${h.id}" title="${esc(t('home.viewProfile'))}" aria-label="${esc(t('home.viewProfile'))}" style="${icon};background:#172f56;color:#fff">${svg('user')}</a>
  <a href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}" target="_blank" rel="noreferrer" title="${esc(t('home.directions'))}" aria-label="${esc(t('home.directions'))}" style="${icon};border:1px solid #bfdbfe;background:#eff6ff;color:#1d4ed8">${svg('nav')}</a>
  ${h.phone ? `<a href="tel:${esc(h.phone.tel)}" title="${esc(t('members.call'))}" aria-label="${esc(t('members.call'))}" style="${icon};border:1px solid #a7f3d0;background:#ecfdf5;color:#047857">${svg('phone')}</a>` : ''}
</div>
</div>`;
}

/** Straight-line distance in km (haversine). */
function km(a, b) {
    const r = (d) => (d * Math.PI) / 180;
    const dLat = r(b.lat - a.lat);
    const dLng = r(b.lng - a.lng);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLng / 2) ** 2;
    return 2 * 6371 * Math.asin(Math.sqrt(h));
}

/**
 * Nearby Homes: the homes pinned on the map (men's profiles only), each opening the profile. Never all at once: the
 * homes of the area on screen are fetched as the map moves / zooms (loadHomesInArea) — the box asked is the view padded
 * by half on each side and snapped to a ~1 km grid, so small moves ask nothing and a view seen before comes from this
 * tab's memory (lib/client-cache.js); homes fetched once stay on the map. A mini loader shows while an area loads.
 * "Near me" asks
 * for the viewer's location (the browser asks first; nothing is stored) and lists the nearest homes with
 * distance and Directions (Google Maps) in a panel floating INSIDE the map — right side on sm+, a bottom sheet on a
 * phone — like Google Maps' results list. It can be closed (the map is then fully visible) and reopened from a chip.
 * `focusId` (?focus=<id>, e.g. the pin button on the Members list): open centred on that home with its card open.
 * `filters` (Nearby ⋮ → Filters): sent with each area request; the page remounts this map when they change.
 * @param {{ count: number, start?: {lat:number,lng:number,zoom:number}|null, bounds?: number[][]|null, seed?: any[], focusId?: number|null, meId?: number|null, filters?: object|null }} props
 */
export default function NearbyHomes({ count, start = null, bounds = null, seed = [], focusId = null, meId = null, filters = null }) {
    const { t } = useT();
    // Every home fetched so far (id -> home), starting with the focused one and my own.
    const [loaded, setLoaded] = useState(() => new Map(seed.map((h) => [h.id, h])));
    const filterKey = filters ? JSON.stringify(filters) : '';
    const homes = useMemo(() => [...loaded.values()], [loaded]);
    const [loading, setLoading] = useState(false);
    const covered = useRef(null); // the last box fetched { s, w, n, e, full }
    const seq = useRef(0);
    const timer = useRef(null);
    useEffect(() => () => clearTimeout(timer.current), []);
    const fetchArea = (v) => {
        const c = covered.current;
        const inside = c && v.s >= c.s && v.n <= c.n && v.w >= c.w && v.e <= c.e;
        // Inside the last box: nothing to ask — unless that box was capped (full) and the view is now much smaller.
        if (inside && (!c.full || v.n - v.s > (c.n - c.s) / 3)) return;
        const dLat = (v.n - v.s) / 2;
        const dLng = (v.e - v.w) / 2;
        const box = {
            s: Math.floor((v.s - dLat) * 100) / 100,
            w: Math.floor((v.w - dLng) * 100) / 100,
            n: Math.ceil((v.n + dLat) * 100) / 100,
            e: Math.ceil((v.e + dLng) * 100) / 100,
        };
        const id = ++seq.current;
        setLoading(true);
        // The page's filters (⋮ → Filters) go with every area; they are part of the cache key.
        fetchCached(`homes:${filterKey}:${box.s}:${box.w}:${box.n}:${box.e}`, () => loadHomesInArea(box, filters))
            .then((res) => {
                if (id !== seq.current) return;
                setLoading(false);
                if (!res?.ok) return void toast.error(t(res?.error ?? 'common.error'));
                covered.current = { ...box, full: res.full };
                setLoaded((prev) => {
                    const next = new Map(prev);
                    for (const h of res.homes) next.set(h.id, h);
                    return next;
                });
            })
            .catch(() => {
                if (id !== seq.current) return;
                setLoading(false);
                toast.error(t('common.error'));
            });
    };
    // The map reports its view after every pan / zoom: list from it at once, fetch once the map has settled.
    const onView = (v) => {
        setArea(v);
        clearTimeout(timer.current);
        timer.current = setTimeout(() => fetchArea(v), 350);
    };
    const [me, setMe] = useState(null);
    const [locating, setLocating] = useState(false);
    const [focus, setFocus] = useState(null);
    // The list: null = not chosen yet — open beside the map on sm+, closed on a phone (a bottom sheet would hide the
    // map) until Near me or the chip; then true / false as the person sets it.
    const [panelOpen, setPanelOpen] = useState(null);
    // The visible part of the map: the list shows only the homes in it, refreshed as the map moves.
    const [area, setArea] = useState(null);
    const markers = useMemo(
        () =>
            homes.map((h) => ({
                id: h.id,
                lat: h.lat,
                lng: h.lng,
                title: h.name,
                // My own home: orange (stands out on the road map and on satellite); everyone else navy.
                tone: h.id === meId ? '#ea580c' : undefined,
                subtitle: h.village ?? '',
                href: `/members/${h.id}`,
                popup: miniProfile(h, t),
            })),
        [homes, t, meId],
    );
    // Homes in the visible area, nearest first — to me after Near me, else to the middle of the map (from the homes
    // fetched so far).
    const nearest = useMemo(() => {
        if (!area) return [];
        const from = me ?? { lat: area.lat, lng: area.lng };
        return homes
            .filter((h) => h.lat >= area.s && h.lat <= area.n && h.lng >= area.w && h.lng <= area.e)
            .map((h) => ({ ...h, d: km(from, h) }))
            .sort((a, b) => a.d - b.d)
            .slice(0, 50);
    }, [homes, me, area]);

    const locate = () => {
        if (!navigator.geolocation) return toast.error(t('home.noGeo'));
        setLocating(true);
        navigator.geolocation.getCurrentPosition(
            (p) => {
                const here = { lat: p.coords.latitude, lng: p.coords.longitude };
                setMe(here);
                setFocus(here);
                setPanelOpen(true);
                setLocating(false);
            },
            () => {
                setLocating(false);
                toast.error(t('home.geoDenied'));
            },
            { enableHighAccuracy: true, timeout: 15000 },
        );
    };

    // The map reaches the bottom edge of the page.
    const fill = useFillHeight();

    return (
        <div className="space-y-3">
            <p className="text-xs text-ink-gray">{t('home.mapHint', { count })}</p>
            {/* The list floats over the map: right column on sm+, a bottom sheet on a phone. It stops short of the
                bottom-right corner (bottom-7) so the OpenStreetMap attribution stays visible. z-[1000] = above
                Leaflet's panes and controls; as a sibling of the map, scrolling it never zooms the map. */}
            <div ref={fill} className="relative h-[calc(100dvh-15rem)] min-h-80">
                <OsmMap
                    markers={markers}
                    me={me}
                    focus={focus}
                    openId={focusId}
                    className="h-full"
                    onView={onView}
                    fit={false}
                    center={start ? [start.lat, start.lng] : undefined}
                    zoom={start?.zoom}
                    bounds={bounds}
                    layerToggle
                    toggleClass={`bottom-[5.25rem] right-3 ${panelOpen === true ? 'max-sm:hidden' : ''}`}
                />
                {/* Homes of this area on their way: a mini loader at the top middle (zoom buttons are top-left). */}
                {loading && (
                    <span
                        role="status"
                        aria-label={t('home.loadingArea')}
                        title={t('home.loadingArea')}
                        className="absolute top-3 left-1/2 z-[1000] inline-flex size-8 -translate-x-1/2 items-center justify-center rounded-full border border-black/10 bg-white text-primary shadow-md"
                    >
                        <Loader2 className="size-4 animate-spin" />
                    </span>
                )}
                {panelOpen !== false && (
                    <div
                        className={`absolute inset-x-2 bottom-7 z-[1000] flex max-h-[45%] flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-xl sm:inset-x-auto sm:bottom-7 sm:right-3 sm:top-3 sm:max-h-none sm:w-80 ${panelOpen === null ? 'max-sm:hidden' : ''}`}
                    >
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-border bg-card-head px-3 py-2">
                            <p className="text-sm font-semibold text-primary">
                                {t(me ? 'home.nearest' : 'home.inView')} <span className="font-normal text-ink-gray tabular-nums">({nearest.length})</span>
                            </p>
                            <button
                                type="button"
                                onClick={() => setPanelOpen(false)}
                                aria-label={t('common.close')}
                                title={t('common.close')}
                                className="inline-flex size-7 items-center justify-center rounded-md text-ink-gray hover:bg-gray-100 hover:text-primary"
                            >
                                <X className="size-4" />
                            </button>
                        </div>
                        {nearest.length === 0 ? (
                            <p className="px-3 py-6 text-center text-sm text-ink-gray">{t('home.noneInView')}</p>
                        ) : (
                            <ul className="min-h-0 flex-1 divide-y divide-surface-border overflow-y-auto">
                                {nearest.map((h) => (
                                    <li key={h.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                                        <button type="button" onClick={() => setFocus({ lat: h.lat, lng: h.lng })} className="min-w-0 flex-1 text-left">
                                            <span className="block truncate text-sm font-medium text-primary">{h.name}</span>
                                            <span className="block truncate text-xs text-ink-gray tabular-nums">
                                                {[me ? (h.d < 1 ? `${Math.round(h.d * 1000)} m` : `${h.d.toFixed(1)} km`) : null, h.village, h.city]
                                                    .filter(Boolean)
                                                    .join(' · ')}
                                            </span>
                                        </button>
                                        {/* Icon-only, like the pin's card: Profile (navy), Directions (light blue), Call (light green, when there is a number). */}
                                        <Link
                                            href={`/members/${h.id}`}
                                            aria-label={t('home.viewProfile')}
                                            title={t('home.viewProfile')}
                                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground hover:bg-primary/90"
                                        >
                                            <LinkIconSpinner className="size-3.5">
                                                <User className="size-3.5" />
                                            </LinkIconSpinner>
                                        </Link>
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={t('home.directions')}
                                            title={t('home.directions')}
                                            className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-blue-200 bg-blue-50 text-blue-700 hover:bg-blue-100"
                                        >
                                            <Navigation className="size-3.5" />
                                        </a>
                                        {h.phone && (
                                            <a
                                                href={`tel:${h.phone.tel}`}
                                                aria-label={`${t('members.call')} ${h.phone.text}`}
                                                title={`${t('members.call')} · ${h.phone.text}`}
                                                className="inline-flex size-8 shrink-0 items-center justify-center rounded-md border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                            >
                                                <Phone className="size-3.5" />
                                            </a>
                                        )}
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                {panelOpen !== true && (
                    <button
                        type="button"
                        onClick={() => setPanelOpen(true)}
                        className={`absolute right-3 top-3 z-[1000] inline-flex h-9 items-center gap-1.5 rounded-md border border-black/20 bg-white px-3 text-sm font-medium text-primary shadow-md hover:bg-gray-50 ${panelOpen === null ? 'sm:hidden' : ''}`}
                    >
                        <List className="size-4" /> {t(me ? 'home.nearest' : 'home.inView')}{' '}
                        <span className="font-normal text-ink-gray tabular-nums">({nearest.length})</span>
                    </button>
                )}
                {/* Near me: on the map's corner like the tree's Focus button, above the OpenStreetMap credit. On a
                    phone the open list (a bottom sheet) covers that corner, so it hides until the list is closed. */}
                <button
                    type="button"
                    onClick={locate}
                    disabled={locating}
                    aria-label={t('home.nearMe')}
                    title={t('home.nearMe')}
                    className={`absolute bottom-8 right-3 z-[1000] inline-flex size-10 items-center justify-center rounded-lg border border-surface-border bg-white text-primary shadow-md hover:bg-accent disabled:opacity-70 ${panelOpen === true ? 'max-sm:hidden' : ''}`}
                >
                    {locating ? <Loader2 className="size-5 animate-spin" /> : <Crosshair className="size-5" />}
                </button>
            </div>
        </div>
    );
}
