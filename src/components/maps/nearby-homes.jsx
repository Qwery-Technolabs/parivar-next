'use client';
import { Crosshair, List, Loader2, Navigation, X } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

const OsmMap = dynamic(() => import('./osm-map'), {
    ssr: false,
    loading: () => (
        <div className="flex h-[65vh] min-h-96 items-center justify-center rounded-lg border border-surface-border bg-white">
            <Loader2 className="size-5 animate-spin text-ink-gray" />
        </div>
    ),
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * The card a pin opens: a person icon, the name, village · city, then View profile and Directions.
 * Leaflet's popup sets its own font (Helvetica/Arial), which made this read heavy — so the card uses the app's
 * font (Geist + the Gujarati/Devanagari fallbacks; --font-sans itself is @theme inline, not a real var) and lighter weights: name 600, buttons 500, place 400.
 */
function miniProfile(h, t) {
    const place = [h.village, h.city].filter(Boolean).join(' · ');
    const btn = 'display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:500;text-decoration:none';
    return `<div style="font-family:var(--font-geist-sans),var(--font-gujarati),var(--font-devanagari),system-ui,sans-serif;font-weight:400">
<div style="display:flex;gap:10px;align-items:center;min-width:190px">
  <span style="display:flex;width:36px;height:36px;flex:none;align-items:center;justify-content:center;border-radius:50%;background:#172f56">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/></svg>
  </span>
  <span style="min-width:0"><span style="display:block;color:#172f56;font-size:13px;font-weight:600">${esc(h.name)}</span>${place ? `<span style="color:#5b6b85;font-size:12px;font-weight:400">${esc(place)}</span>` : ''}</span>
</div>
<div style="display:flex;gap:6px;margin-top:10px">
  <a href="/members/${h.id}" style="${btn};background:#172f56;color:#fff">${esc(t('home.viewProfile'))}</a>
  <a href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}" target="_blank" rel="noreferrer" style="${btn};border:1px solid #d6dbe4;color:#172f56">${esc(t('home.directions'))}</a>
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
 * Nearby Homes: every home pinned on the map (men's profiles only), each opening the profile. "Near me" asks
 * for the viewer's location (the browser asks first; nothing is stored) and lists the nearest homes with
 * distance and Directions (Google Maps) in a panel floating INSIDE the map — right side on sm+, a bottom sheet on a
 * phone — like Google Maps' results list. It can be closed (the map is then fully visible) and reopened from a chip.
 * `focusId` (?focus=<id>, e.g. the pin button on the Members list): open centred on that home with its card open.
 * @param {{ homes: Array<{ id: number, name: string, village: string|null, city?: string|null, lat: number, lng: number }>, focusId?: number|null }} props
 */
export default function NearbyHomes({ homes, focusId = null }) {
    const { t } = useT();
    const [me, setMe] = useState(null);
    const [locating, setLocating] = useState(false);
    const [focus, setFocus] = useState(null);
    const [panelOpen, setPanelOpen] = useState(true);
    const markers = useMemo(
        () =>
            homes.map((h) => ({
                id: h.id,
                lat: h.lat,
                lng: h.lng,
                title: h.name,
                subtitle: h.village ?? '',
                href: `/members/${h.id}`,
                popup: miniProfile(h, t),
            })),
        [homes, t],
    );
    const nearest = useMemo(
        () =>
            me
                ? homes
                      .map((h) => ({ ...h, d: km(me, h) }))
                      .sort((a, b) => a.d - b.d)
                      .slice(0, 30)
                : [],
        [homes, me],
    );

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

    return (
        <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
                <p className="text-xs text-ink-gray">{t('home.mapHint', { count: homes.length })}</p>
                <button
                    type="button"
                    onClick={locate}
                    disabled={locating}
                    className="btn-secondary inline-flex h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium"
                >
                    {locating ? <Loader2 className="size-4 animate-spin" /> : <Crosshair className="size-4" />} {t('home.nearMe')}
                </button>
            </div>
            {/* The list floats over the map: right column on sm+, a bottom sheet on a phone. It stops short of the
                bottom-right corner (bottom-7) so the OpenStreetMap attribution stays visible. z-[1000] = above
                Leaflet's panes and controls; as a sibling of the map, scrolling it never zooms the map. */}
            <div className="relative">
                <OsmMap markers={markers} me={me} focus={focus} openId={focusId} className="h-[65vh] min-h-96" />
                {me && panelOpen && (
                    <div className="absolute inset-x-2 bottom-7 z-[1000] flex max-h-[45%] flex-col overflow-hidden rounded-xl border border-surface-border bg-white shadow-xl sm:inset-x-auto sm:bottom-7 sm:right-3 sm:top-3 sm:max-h-none sm:w-80">
                        <div className="flex shrink-0 items-center justify-between gap-2 border-b border-surface-border bg-card-head px-3 py-2">
                            <p className="text-sm font-semibold text-primary">
                                {t('home.nearest')} <span className="font-normal text-ink-gray tabular-nums">({nearest.length})</span>
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
                            <p className="px-3 py-6 text-center text-sm text-ink-gray">{t('home.none')}</p>
                        ) : (
                            <ul className="min-h-0 flex-1 divide-y divide-surface-border overflow-y-auto">
                                {nearest.map((h) => (
                                    <li key={h.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50">
                                        <button type="button" onClick={() => setFocus({ lat: h.lat, lng: h.lng })} className="min-w-0 flex-1 text-left">
                                            <span className="block truncate text-sm font-medium text-primary">{h.name}</span>
                                            <span className="block truncate text-xs text-ink-gray tabular-nums">
                                                {h.d < 1 ? `${Math.round(h.d * 1000)} m` : `${h.d.toFixed(1)} km`}
                                                {h.village ? ` · ${h.village}` : ''}
                                            </span>
                                        </button>
                                        <Link href={`/members/${h.id}`} className="shrink-0 text-xs font-medium text-primary hover:underline">
                                            {t('home.profile')}
                                        </Link>
                                        <a
                                            href={`https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            aria-label={t('home.directions')}
                                            title={t('home.directions')}
                                            className="btn-secondary inline-flex size-8 shrink-0 items-center justify-center rounded-md"
                                        >
                                            <Navigation className="size-3.5" />
                                        </a>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                )}
                {me && !panelOpen && (
                    <button
                        type="button"
                        onClick={() => setPanelOpen(true)}
                        className="absolute right-3 top-3 z-[1000] inline-flex h-9 items-center gap-1.5 rounded-md border border-black/20 bg-white px-3 text-sm font-medium text-primary shadow-md hover:bg-gray-50"
                    >
                        <List className="size-4" /> {t('home.nearest')}
                    </button>
                )}
            </div>
        </div>
    );
}
