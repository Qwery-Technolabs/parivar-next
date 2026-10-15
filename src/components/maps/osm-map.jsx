'use client';
import 'leaflet/dist/leaflet.css';
import { Map as MapIcon, Satellite } from 'lucide-react';
import { useEffect, useRef, useState } from 'react';
import { useT } from '@/lib/i18n/client';

// A small person (head + shoulders), white — inside a home pin.
const PERSON_SVG =
    '<svg viewBox="0 0 24 24" width="16" height="16" fill="#fff" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0z"/></svg>';

/** A pin drawn with CSS (no image files to bundle): the brand navy drop — a person on a home, a dot on a picked spot. */
function pinIcon(L, tone = '#172f56', person = false) {
    const inner = person
        ? `<span style="display:flex;width:100%;height:100%;align-items:center;justify-content:center;transform:rotate(45deg)">${PERSON_SVG}</span>`
        : '<span style="display:block;width:8px;height:8px;margin:7px;border-radius:50%;background:#fff"></span>';
    const size = person ? 32 : 26;
    return L.divIcon({
        className: '',
        html: `<span style="display:block;width:${size}px;height:${size}px;border-radius:50% 50% 50% 0;background:${tone};transform:rotate(-45deg);border:2px solid #fff;box-shadow:0 2px 6px rgb(0 0 0/.35)">${inner}</span>`,
        iconSize: [size, size],
        iconAnchor: [size / 2, size],
        popupAnchor: [0, -size + 2],
    });
}

// Map / Satellite last chosen on this device (localStorage — a per-device convenience; unreadable = the road map).
const VIEW_KEY = 'pv-map-view';
const savedView = () => {
    try {
        return localStorage.getItem(VIEW_KEY) === 'satellite' ? 'satellite' : 'road';
    } catch {
        return 'road';
    }
};

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

// Base maps (free, open source, no key). Road: OpenStreetMap's own tiles.
// Satellite: Esri World Imagery with Esri's road + place-name overlays on top (a "hybrid" view).
const OSM = '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>';
const BASEMAPS = {
    road: [{ url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png', opts: { maxZoom: 19, attribution: OSM } }],
    satellite: [
        {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            opts: { maxNativeZoom: 18, maxZoom: 20, attribution: 'Imagery &copy; Esri, Maxar, Earthstar Geographics' },
        },
        {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Transportation/MapServer/tile/{z}/{y}/{x}',
            opts: { maxNativeZoom: 18, maxZoom: 20 },
        },
        {
            url: 'https://server.arcgisonline.com/ArcGIS/rest/services/Reference/World_Boundaries_and_Places/MapServer/tile/{z}/{y}/{x}',
            opts: { maxNativeZoom: 18, maxZoom: 20 },
        },
    ],
};

/** The base layers of a view. */
function baseLayers(L, view) {
    return BASEMAPS[view].map((x) => L.tileLayer(x.url, x.opts));
}

/**
 * An OpenStreetMap map (Leaflet, open source — no key). Two uses:
 *   markers   [{ id, lat, lng, title, subtitle?, href?, popup? }] — homes (person pins), each opening a small card
 *             (`popup` = its ready HTML); `openId` = the home to centre on with its card open
 *   pick      { lat, lng } | null + onPick(lat, lng) — one draggable pin; tapping the map moves it there
 * `layerToggle`: a Map ⇄ Satellite button on the map (`toggleClass` places it, default bottom-right).
 * `onView({ s, w, n, e, lat, lng })`: the visible area (and its centre), after every pan / zoom.
 * `me` { lat, lng } draws the viewer's position (a dark dot with a soft ring). A marker's `tone` colours its pin (own home: orange).
 * Opens on `bounds` [[s, w], [n, e]] when given, else `center` / `zoom`. `fit` (default): fit the view to the markers
 * whenever they change — off when the markers are loaded BY the view (Nearby Homes), or every load would move the map.
 * Markers are kept by id: new ones are added, gone ones removed, the rest (and an open card) stay.
 * @param {{ markers?: any[], pick?: {lat:number,lng:number}|null, onPick?: (lat:number, lng:number) => void, me?: {lat:number,lng:number}|null,
 *           center?: [number, number], zoom?: number, className?: string, focus?: {lat:number,lng:number}|null }} props
 */
export default function OsmMap({
    markers = [],
    pick = undefined,
    onPick,
    me = null,
    center = [21.17, 72.83],
    zoom = 12,
    className = '',
    focus = null,
    openId = null,
    layerToggle = false,
    toggleClass = 'bottom-8 right-3',
    onView,
    fit = true,
    bounds = null,
}) {
    const onViewRef = useRef(onView);
    useEffect(() => {
        onViewRef.current = onView;
    }, [onView]);
    const { t } = useT();
    const [view, setView] = useState('road');
    const base = useRef(null);
    const box = useRef(null);
    const map = useRef(null);
    const layer = useRef(null);
    const pickMarker = useRef(null);
    const meMarker = useRef(null);
    const Lref = useRef(null);
    const drawn = useRef(new Map()); // marker id -> Leaflet marker
    const openedOnce = useRef(false);
    const onPickRef = useRef(onPick);
    useEffect(() => {
        onPickRef.current = onPick;
    }, [onPick]);

    // Create the map once (Leaflet needs the browser: loaded here, not on the server).
    useEffect(() => {
        let cancelled = false;
        let ro = null;
        import('leaflet').then((mod) => {
            if (cancelled || !box.current || map.current) return;
            const L = mod.default ?? mod;
            Lref.current = L;
            const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(center, zoom);
            if (bounds) m.fitBounds(bounds, { padding: [30, 30], maxZoom: 15 });
            // Open on the view chosen last time (only where the toggle is shown).
            const first = layerToggle ? savedView() : 'road';
            base.current = L.layerGroup(baseLayers(L, first)).addTo(m);
            if (first !== 'road') setView(first);
            layer.current = L.layerGroup().addTo(m);
            if (pick !== undefined)
                m.on('click', (e) => {
                    onPickRef.current?.(e.latlng.lat, e.latlng.lng);
                });
            map.current = m;
            // The visible area, after every pan / zoom (and once now).
            const report = () => {
                const b = m.getBounds();
                const c = m.getCenter();
                onViewRef.current?.({ s: b.getSouth(), w: b.getWest(), n: b.getNorth(), e: b.getEast(), lat: c.lat, lng: c.lng });
            };
            m.on('moveend', report);
            setTimeout(report, 60);
            // First draw of markers / pin happens in the effects below once the map exists.
            m.fire('pv-ready');
            setTimeout(() => m.invalidateSize(), 50);
            // The box can change size (Nearby Homes fills the screen): redraw the tiles to fit.
            ro = new ResizeObserver(() => m.invalidateSize());
            ro.observe(box.current);
        });
        return () => {
            cancelled = true;
            ro?.disconnect();
            map.current?.remove();
            map.current = null;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Homes.
    useEffect(() => {
        const draw = () => {
            const L = Lref.current;
            const m = map.current;
            if (!L || !m) return false;
            const pts = [];
            const keep = new Set();
            let opened = null;
            for (const p of markers) {
                const id = p.id ?? `${p.lat},${p.lng}`;
                keep.add(id);
                let mk = drawn.current.get(id);
                if (!mk) {
                    mk = L.marker([p.lat, p.lng], { icon: pinIcon(L, p.tone ?? '#172f56', true), zIndexOffset: p.tone ? 1000 : 0 }).addTo(layer.current);
                    const title = p.href
                        ? `<a href="${escapeHtml(p.href)}" style="font-weight:600;color:#172f56">${escapeHtml(p.title)}</a>`
                        : `<b>${escapeHtml(p.title)}</b>`;
                    mk.bindPopup(p.popup ?? `${title}${p.subtitle ? `<br><span style="color:#5b6b85">${escapeHtml(p.subtitle)}</span>` : ''}`, {
                        minWidth: 200,
                    });
                    drawn.current.set(id, mk);
                }
                if (openId != null && p.id === openId) opened = mk;
                pts.push([p.lat, p.lng]);
            }
            for (const [id, mk] of drawn.current) {
                if (!keep.has(id)) {
                    mk.remove();
                    drawn.current.delete(id);
                }
            }
            // ?focus=<id>: that home in the middle, its card open (once); else (with `fit`) every home in view.
            if (opened && !openedOnce.current) {
                openedOnce.current = true;
                m.setView(opened.getLatLng(), 16);
                opened.openPopup();
            } else if (fit && !opened && pts.length && !focus) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
            return true;
        };
        if (!draw()) {
            const id = setInterval(() => draw() && clearInterval(id), 100);
            return () => clearInterval(id);
        }
    }, [markers, focus, openId, fit]);

    // The pin being placed.
    useEffect(() => {
        const draw = () => {
            const L = Lref.current;
            const m = map.current;
            if (!L || !m) return false;
            if (!pick) {
                pickMarker.current?.remove();
                pickMarker.current = null;
                return true;
            }
            if (!pickMarker.current) {
                pickMarker.current = L.marker([pick.lat, pick.lng], { draggable: true, icon: pinIcon(L, '#c2410c') }).addTo(m);
                pickMarker.current.on('dragend', (e) => {
                    const ll = e.target.getLatLng();
                    onPickRef.current?.(ll.lat, ll.lng);
                });
                m.setView([pick.lat, pick.lng], Math.max(m.getZoom(), 16));
            } else pickMarker.current.setLatLng([pick.lat, pick.lng]);
            return true;
        };
        if (pick === undefined) return;
        if (!draw()) {
            const id = setInterval(() => draw() && clearInterval(id), 100);
            return () => clearInterval(id);
        }
    }, [pick]);

    // The viewer's own position, and a requested focus point.
    useEffect(() => {
        const draw = () => {
            const L = Lref.current;
            const m = map.current;
            if (!L || !m) return false;
            meMarker.current?.remove();
            meMarker.current = me
                ? L.layerGroup([
                      L.circleMarker([me.lat, me.lng], { radius: 18, stroke: false, fillColor: '#111827', fillOpacity: 0.15, interactive: false }),
                      L.circleMarker([me.lat, me.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#111827', fillOpacity: 1 }),
                  ]).addTo(m)
                : null;
            if (focus) m.setView([focus.lat, focus.lng], Math.max(m.getZoom(), 15));
            return true;
        };
        if (!draw()) {
            const id = setInterval(() => draw() && clearInterval(id), 100);
            return () => clearInterval(id);
        }
    }, [me, focus]);

    // Map ⇄ Satellite: swap the base tiles under the pins.
    useEffect(() => {
        const L = Lref.current;
        const m = map.current;
        if (!L || !m || !base.current) return;
        base.current.remove();
        base.current = L.layerGroup(baseLayers(L, view)).addTo(m);
        base.current.eachLayer((l) => l.bringToBack?.());
    }, [view]);

    const sat = view === 'satellite';
    return (
        <div className={`relative ${className}`}>
            <div ref={box} className="z-0 size-full overflow-hidden rounded-lg border border-surface-border" />
            {layerToggle && (
                <button
                    type="button"
                    onClick={() => {
                        const next = sat ? 'road' : 'satellite';
                        setView(next);
                        try {
                            localStorage.setItem(VIEW_KEY, next);
                        } catch {
                            // Private window / blocked storage: just not remembered.
                        }
                    }}
                    aria-label={t(sat ? 'home.mapView' : 'home.satellite')}
                    title={t(sat ? 'home.mapView' : 'home.satellite')}
                    className={`absolute z-[1000] inline-flex size-10 items-center justify-center rounded-lg border border-surface-border bg-white text-primary shadow-md hover:bg-accent ${toggleClass}`}
                >
                    {sat ? <MapIcon className="size-5" /> : <Satellite className="size-5" />}
                </button>
            )}
        </div>
    );
}
