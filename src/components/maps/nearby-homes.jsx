'use client';
import { Crosshair, Loader2, Navigation } from 'lucide-react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useT } from '@/lib/i18n/client';

const OsmMap = dynamic(() => import('./osm-map'), {
    ssr: false,
    loading: () => (
        <div className="flex h-[60vh] items-center justify-center rounded-lg border border-surface-border bg-white">
            <Loader2 className="size-5 animate-spin text-ink-gray" />
        </div>
    ),
});

const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/** The card a pin opens: a person icon, the name, village · city, then View profile and Directions. */
function miniProfile(h, t) {
    const place = [h.village, h.city].filter(Boolean).join(' · ');
    const btn = 'display:inline-flex;align-items:center;height:28px;padding:0 10px;border-radius:6px;font-size:12px;font-weight:600;text-decoration:none';
    return `<div style="display:flex;gap:10px;align-items:center;min-width:190px">
  <span style="display:flex;width:36px;height:36px;flex:none;align-items:center;justify-content:center;border-radius:50%;background:#172f56">
    <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/></svg>
  </span>
  <span style="min-width:0"><b style="display:block;color:#172f56;font-size:13px">${esc(h.name)}</b>${place ? `<span style="color:#5b6b85;font-size:12px">${esc(place)}</span>` : ''}</span>
</div>
<div style="display:flex;gap:6px;margin-top:10px">
  <a href="/members/${h.id}" style="${btn};background:#172f56;color:#fff">${esc(t('home.viewProfile'))}</a>
  <a href="https://www.google.com/maps/dir/?api=1&destination=${h.lat},${h.lng}" target="_blank" rel="noreferrer" style="${btn};border:1px solid #d6dbe4;color:#172f56">${esc(t('home.directions'))}</a>
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
 * distance and Directions (Google Maps).
 * `focusId` (?focus=<id>, e.g. the pin button on the Members list): open centred on that home with its card open.
 * @param {{ homes: Array<{ id: number, name: string, village: string|null, city?: string|null, lat: number, lng: number }>, focusId?: number|null }} props
 */
export default function NearbyHomes({ homes, focusId = null }) {
    const { t } = useT();
    const [me, setMe] = useState(null);
    const [locating, setLocating] = useState(false);
    const [focus, setFocus] = useState(null);
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
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_22rem]">
                <OsmMap markers={markers} me={me} focus={focus} openId={focusId} className="h-[60vh] min-h-80" />
                {me && (
                    <div className="max-h-[60vh] overflow-y-auto rounded-lg border border-surface-border bg-white">
                        <p className="sticky top-0 border-b border-surface-border bg-card-head px-3 py-2 text-sm font-semibold text-primary">
                            {t('home.nearest')}
                        </p>
                        {nearest.length === 0 ? (
                            <p className="px-3 py-6 text-center text-sm text-ink-gray">{t('home.none')}</p>
                        ) : (
                            <ul className="divide-y divide-surface-border">
                                {nearest.map((h) => (
                                    <li key={h.id} className="flex items-center gap-2 px-3 py-2">
                                        <button type="button" onClick={() => setFocus({ lat: h.lat, lng: h.lng })} className="min-w-0 flex-1 text-left">
                                            <span className="block truncate text-sm font-medium text-primary">{h.name}</span>
                                            <span className="block text-xs text-ink-gray tabular-nums">
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
            </div>
        </div>
    );
}
