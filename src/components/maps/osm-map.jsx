'use client';
import 'leaflet/dist/leaflet.css';
import { useEffect, useRef } from 'react';

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

const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

/**
 * An OpenStreetMap map (Leaflet, open source — no key). Two uses:
 *   markers   [{ id, lat, lng, title, subtitle?, href?, popup? }] — homes (person pins), each opening a small card
 *             (`popup` = its ready HTML); `openId` = the home to centre on with its card open
 *   pick      { lat, lng } | null + onPick(lat, lng) — one draggable pin; tapping the map moves it there
 * `me` { lat, lng } draws the viewer's position (orange). The map fits the markers, else centres on `center`.
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
}) {
    const box = useRef(null);
    const map = useRef(null);
    const layer = useRef(null);
    const pickMarker = useRef(null);
    const meMarker = useRef(null);
    const Lref = useRef(null);
    const onPickRef = useRef(onPick);
    useEffect(() => {
        onPickRef.current = onPick;
    }, [onPick]);

    // Create the map once (Leaflet needs the browser: loaded here, not on the server).
    useEffect(() => {
        let cancelled = false;
        import('leaflet').then((mod) => {
            if (cancelled || !box.current || map.current) return;
            const L = mod.default ?? mod;
            Lref.current = L;
            const m = L.map(box.current, { zoomControl: true, attributionControl: true }).setView(center, zoom);
            L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
                maxZoom: 19,
                attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noreferrer">OpenStreetMap</a>',
            }).addTo(m);
            layer.current = L.layerGroup().addTo(m);
            if (pick !== undefined)
                m.on('click', (e) => {
                    onPickRef.current?.(e.latlng.lat, e.latlng.lng);
                });
            map.current = m;
            // First draw of markers / pin happens in the effects below once the map exists.
            m.fire('pv-ready');
            setTimeout(() => m.invalidateSize(), 50);
        });
        return () => {
            cancelled = true;
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
            layer.current.clearLayers();
            const pts = [];
            let opened = null;
            for (const p of markers) {
                const mk = L.marker([p.lat, p.lng], { icon: pinIcon(L, '#172f56', true) }).addTo(layer.current);
                const title = p.href
                    ? `<a href="${escapeHtml(p.href)}" style="font-weight:600;color:#172f56">${escapeHtml(p.title)}</a>`
                    : `<b>${escapeHtml(p.title)}</b>`;
                mk.bindPopup(p.popup ?? `${title}${p.subtitle ? `<br><span style="color:#5b6b85">${escapeHtml(p.subtitle)}</span>` : ''}`, { minWidth: 200 });
                if (openId != null && p.id === openId) opened = mk;
                pts.push([p.lat, p.lng]);
            }
            // ?focus=<id>: that home in the middle, its card open; else every home in view.
            if (opened) {
                m.setView(opened.getLatLng(), 16);
                opened.openPopup();
            } else if (pts.length && !focus) m.fitBounds(pts, { padding: [30, 30], maxZoom: 15 });
            return true;
        };
        if (!draw()) {
            const id = setInterval(() => draw() && clearInterval(id), 100);
            return () => clearInterval(id);
        }
    }, [markers, focus, openId]);

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
                ? L.circleMarker([me.lat, me.lng], { radius: 8, color: '#fff', weight: 2, fillColor: '#ea580c', fillOpacity: 1 }).addTo(m)
                : null;
            if (focus) m.setView([focus.lat, focus.lng], Math.max(m.getZoom(), 15));
            return true;
        };
        if (!draw()) {
            const id = setInterval(() => draw() && clearInterval(id), 100);
            return () => clearInterval(id);
        }
    }, [me, focus]);

    return <div ref={box} className={`z-0 w-full overflow-hidden rounded-lg border border-surface-border ${className}`} />;
}
