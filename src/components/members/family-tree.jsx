'use client';
import { Focus, Loader2 } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useMemo, useRef, useState } from 'react';
import Switch from '@/components/ui/switch';
import useFillHeight from '@/components/ui/use-fill-height';
import { age } from '@/lib/format';
import { useT } from '@/lib/i18n/client';
import { birthName } from '@/lib/names';

// Avatar silhouettes (64×64 box) — the same paths draw the legend (SVG) and the tiles (canvas).
const circle = (cx, cy, r) => `M${cx - r} ${cy}a${r} ${r} 0 1 0 ${2 * r} 0a${r} ${r} 0 1 0 ${-2 * r} 0z`;
const MAN = { head: circle(32, 23, 11), body: 'M32 37c-11 0-19 6.5-19 15v4h38v-4c0-8.5-8-15-19-15z' };
const WOMAN = {
    // hair falling to the shoulders, behind the face
    hair: 'M32 9c-9 0-15 6.5-15 15.5 0 5 .8 9.5-2.5 14 3.5 1.2 7.5.6 10-1.2L32 38l7.5-.7c2.5 1.8 6.5 2.4 10 1.2-3.3-4.5-2.5-9-2.5-14C47 15.5 41 9 32 9z',
    head: circle(32, 24, 10),
    body: 'M32 38c-11 0-19 6.5-19 15v3h38v-3c0-8.5-8-15-19-15z',
};

function ManIcon({ className = '' }) {
    return (
        <svg viewBox="0 0 64 64" aria-hidden className={className}>
            <path d={MAN.head} fill="currentColor" />
            <path d={MAN.body} fill="currentColor" />
        </svg>
    );
}
function WomanIcon({ className = '' }) {
    return (
        <svg viewBox="0 0 64 64" aria-hidden className={className}>
            <path d={WOMAN.hair} fill="currentColor" opacity="0.85" />
            <path d={WOMAN.head} fill="currentColor" />
            <path d={WOMAN.body} fill="currentColor" />
        </svg>
    );
}

// Sizes in tree units (= CSS px at 100% zoom).
const TILE_W = 56;
const TILE_GAP = 3; // between the tiles of a couple
const CARD_PAD = 3;
const SIDE = 10; // room either side of a branch
const DROP = 28; // half the vertical step between generations (the bar sits in the middle)
const EDGE = 24; // margin round the whole tree
const tileHeight = (details) => (details ? 88.5 : 64.5);

const MIN_ZOOM = 0.03;
const MAX_ZOOM = 2.5;
const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));

/** A daughter who has married (married-like status or a recorded husband) — worked out by the server (`md`). */
const marriedDaughter = (n) => Boolean(n.md);

// The figures as canvas shapes, made once (browser only).
let shapes = null;
const figureShapes = () =>
    (shapes ??= {
        man: [new Path2D(MAN.head), new Path2D(MAN.body)],
        woman: [new Path2D(WOMAN.head), new Path2D(WOMAN.body)],
        hair: new Path2D(WOMAN.hair),
    });

/**
 * Positions for every card, computed ONCE per tree / switch change (never while dragging or zooming).
 * Same shape as the old nested-list tree: each branch as wide as its card or its children together, the card centred
 * over its children; every generation on one level.
 *  - couples: husband left, wife right — a married daughter in her father's line comes first, her husband on the right;
 *  - a married daughter's children only in her own tree (and her husband's), never in the rest of her father's family's;
 *  - "Married daughters" off: married daughters (and their branch) leave every chain — never the person whose tree it is.
 */
function layoutTree(tree, showDetails, showMarried, describe) {
    const rootId = tree.rootId;
    const th = tileHeight(showDetails);
    const ch = th + 2 * CARD_PAD;
    const step = ch + 2 * DROP;
    const cards = [];
    const links = [];
    let root = null;
    let bottom = 0;

    const measure = (node, top) => {
        const outMarried = !top && marriedDaughter(node);
        const kids = outMarried && node.id !== rootId ? [] : showMarried ? node.children : node.children.filter((c) => c.id === rootId || !marriedDaughter(c));
        const people = [node, ...node.spouses];
        const ordered = outMarried ? people : [...people.filter((p) => p.gender === 'male'), ...people.filter((p) => p.gender !== 'male')];
        const cardW = ordered.length * TILE_W + (ordered.length - 1) * TILE_GAP + 2 * CARD_PAD;
        const children = kids.map((c) => measure(c, false));
        const kidsW = children.reduce((s, c) => s + c.w, 0);
        return { node, ordered, leaf: node.spouses.length === 0 && kids.length === 0, cardW, children, kidsW, w: Math.max(cardW, kidsW) + 2 * SIDE };
    };
    const place = (b, left, depth) => {
        const cx = left + b.w / 2;
        const x = cx - b.cardW / 2;
        const y = EDGE + depth * step;
        bottom = Math.max(bottom, y + ch);
        const tiles = b.ordered.map((p, i) => {
            const tile = {
                ...describe(p, { leaf: b.leaf && p.id === b.node.id, birth: p.id === b.node.id }),
                id: p.id,
                x: x + CARD_PAD + i * (TILE_W + TILE_GAP),
                y: y + CARD_PAD,
            };
            if (p.id === rootId) root = tile;
            return tile;
        });
        cards.push({ x, y, w: b.cardW, h: ch, tiles });
        if (!b.children.length) return;
        let l = cx - b.kidsW / 2;
        const xs = [];
        for (const c of b.children) {
            xs.push(l + c.w / 2);
            place(c, l, depth + 1);
            l += c.w;
        }
        links.push({ cx, y0: y + ch, y1: y + ch + 2 * DROP, xs });
    };
    const top = measure(tree.top, true);
    place(top, EDGE, 0);
    return { cards, links, th, root, width: top.w + 2 * EDGE, height: bottom + EDGE, people: cards.flatMap((c) => c.tiles) };
}

/** A rounded rectangle path (ctx.roundRect where the browser has it). */
function rounded(ctx, x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) return ctx.roundRect(x, y, w, h, r);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
}

/**
 * The family line as a tree: the oldest recorded ancestor at the top, every descendant below.
 * Drawn on ONE canvas (like Figma): the layout is worked out once, then only the part on screen is painted — the
 * browser uses the graphics chip when there is one, the processor otherwise. Zoomed far out, cards become plain
 * tiles (no figures / names), so even thousands of people stay smooth.
 * Redrawn only when something changes (a move, zoom, hover, switch) — never on a timer, so an idle tree costs nothing.
 * Inside the box: drag to move (a drag never opens a card), pinch with two fingers to zoom — on a laptop, pinch the
 * trackpad or Ctrl + scroll; plain scrolling moves. Tap a card → profile; hover (desktop) or long-press (phone) →
 * name · relation · age. Keyboard: arrows move, + / − zoom, 0 back to the person.
 */
export default function FamilyTree({ tree, showDetails, showMarried, onDetails, onMarried, busy = false }) {
    const { t, locale } = useT();
    const router = useRouter();
    const [tip, setTip] = useState(null); // { text, x, y } — hover / long-press bubble
    const fill = useFillHeight(); // the canvas reaches the bottom edge of the page
    const box = useRef(null);
    const canvas = useRef(null);
    const cam = useRef({ s: 1, tx: 0, ty: 0 });
    const view = useRef({ w: 0, h: 0, dpr: 1 });
    const frame = useRef(0);
    const hover = useRef(null);
    const pointers = useRef(new Map());
    const drag = useRef(null);
    const pinch = useRef(null);
    const textFit = useRef(new Map()); // "font|text" → the text cut to fit a tile
    const font = useRef('sans-serif'); // the page font, read once
    const grads = useRef(null); // tile gradients, made once per tile height
    const paint = useRef(() => {});

    const describe = useMemo(() => {
        const local = locale !== 'en';
        return (p, { leaf, birth }) => {
            const a = age(p.dob);
            const late = p.status === 'deceased';
            const kin = p.kin ? t(`kin.terms.${p.kin}`) : null;
            // A daughter in her father's line goes by her maiden name; a wife (spouse) by her married name.
            const fullName = (birth && birthName(p, local)) || (local && p.full_name_local) || p.full_name;
            return {
                name: (local && (p.first_name_local || p.full_name_local)) || p.first_name || p.full_name,
                hover: [fullName, kin, late ? t('family.late') : a != null ? `${a} ${t('matrimony.years')}` : null].filter(Boolean).join(' · '),
                line1: [kin, late ? t('family.late') : a != null ? a : null].filter(Boolean).join(' · '),
                // The end of a line (no spouse, no children): Details also says whether they are married yet.
                line2: leaf && !late && p.marital_status ? t(`family.marital.${p.marital_status}`) : '',
                female: p.gender === 'female',
                late,
                isRoot: p.id === tree.rootId,
            };
        };
    }, [t, locale, tree.rootId]);
    const L = useMemo(() => layoutTree(tree, showDetails, showMarried, describe), [tree, showDetails, showMarried, describe]);
    const layout = useRef(L);

    const invalidate = () => {
        if (!frame.current) frame.current = requestAnimationFrame(() => paint.current());
    };
    const zoomLimits = () => {
        const { w, h } = view.current;
        const fit = Math.min(w / layout.current.width, h / layout.current.height) * 0.9;
        return [clamp(Math.min(0.35, fit), MIN_ZOOM, 0.35), MAX_ZOOM];
    };
    /** Move / zoom the camera — the tree can't be pushed fully out of the box. */
    const setCam = (s, tx, ty) => {
        const { w, h } = view.current;
        const m = 60;
        const T = layout.current;
        cam.current = { s, tx: clamp(tx, Math.min(m - T.width * s, w - m), w - m), ty: clamp(ty, Math.min(m - T.height * s, h - m), h - m) };
        invalidate();
    };
    /** Zoom to `next`, keeping the point (cx, cy) — relative to the box — under the fingers / pointer. */
    const zoomAt = (next, cx, cy) => {
        const { s, tx, ty } = cam.current;
        const [lo, hi] = zoomLimits();
        const s2 = clamp(next, lo, hi);
        if (Math.abs(s2 - s) < 0.0005) return;
        setCam(s2, cx - (cx - tx) * (s2 / s), cy - (cy - ty) * (s2 / s));
    };
    /** Bring the person whose tree it is to the middle of the box (smoothly when asked). */
    const centerOnRoot = (smooth = false) => {
        const r = layout.current.root;
        const { w, h } = view.current;
        if (!r || !w) return;
        const { s, tx: fx, ty: fy } = cam.current;
        const gx = w / 2 - (r.x + TILE_W / 2) * s;
        const gy = h / 2 - (r.y + layout.current.th / 2) * s;
        if (!smooth) return setCam(s, gx, gy);
        const t0 = performance.now();
        const ease = (k) => 1 - (1 - k) ** 3;
        const tick = (now) => {
            const k = ease(Math.min(1, (now - t0) / 300));
            setCam(s, fx + (gx - fx) * k, fy + (gy - fy) * k);
            if (k < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
    };
    /** The person under a point of the box, or null. */
    const hitTest = (sx, sy) => {
        const { s, tx, ty } = cam.current;
        const x = (sx - tx) / s;
        const y = (sy - ty) / s;
        const T = layout.current;
        for (const c of T.cards) {
            if (x < c.x || x > c.x + c.w || y < c.y || y > c.y + c.h) continue;
            return c.tiles.find((p) => x >= p.x && x <= p.x + TILE_W && y >= p.y && y <= p.y + T.th) ?? null;
        }
        return null;
    };
    const local = (e) => {
        const r = box.current.getBoundingClientRect();
        return [e.clientX - r.left, e.clientY - r.top];
    };
    const showTip = (p) => {
        const { s, tx, ty } = cam.current;
        setTip({ text: p.hover, x: tx + (p.x + TILE_W / 2) * s, y: ty + p.y * s });
    };

    // Paint: only cards and lines inside the box; detail drops as the zoom does.
    // (Set after each render — it reads refs only — so the effects below always call the current one.)
    useEffect(() => {
        paint.current = () => {
            frame.current = 0;
            const cv = canvas.current;
            if (!cv) return;
            const ctx = cv.getContext('2d');
            const { w, h, dpr } = view.current;
            const { s, tx, ty } = cam.current;
            const T = layout.current;
            const th = T.th;
            ctx.setTransform(1, 0, 0, 1, 0, 0);
            ctx.clearRect(0, 0, cv.width, cv.height);
            const a = dpr * s;
            const e = dpr * tx;
            const f = dpr * ty;
            // The part of the tree inside the box.
            const x0 = -tx / s;
            const y0 = -ty / s;
            const x1 = (w - tx) / s;
            const y1 = (h - ty) / s;
            const detail = s >= 0.45 ? 2 : s >= 0.18 ? 1 : 0; // 2 full · 1 figures, no text · 0 plain tiles

            // Connector lines: parent card → bar → each child.
            ctx.setTransform(a, 0, 0, a, e, f);
            ctx.strokeStyle = '#6b7280';
            ctx.lineWidth = Math.max(2, 1 / s);
            ctx.beginPath();
            for (const k of T.links) {
                const lo = k.xs[0];
                const hi = k.xs[k.xs.length - 1];
                if (hi < x0 || lo > x1 || k.y1 < y0 || k.y0 > y1) continue;
                const mid = k.y0 + DROP;
                ctx.moveTo(k.cx, k.y0);
                ctx.lineTo(k.cx, mid);
                if (k.xs.length > 1) {
                    ctx.moveTo(lo, mid);
                    ctx.lineTo(hi, mid);
                }
                for (const x of k.xs) {
                    ctx.moveTo(x, mid);
                    ctx.lineTo(x, k.y1);
                }
            }
            ctx.stroke();

            // Tile colours: one gradient each, in tile coordinates (re-used by every tile, made once per tile height).
            if (grads.current?.th !== th) {
                const grad = (from, to) => {
                    const g = ctx.createLinearGradient(0, 0, TILE_W, th);
                    g.addColorStop(0, from);
                    g.addColorStop(1, to);
                    return g;
                };
                grads.current = { th, navy: grad('#4a6390', '#172f56'), grey: grad('#d1d5db', '#6b7280') };
            }
            const navy = detail ? grads.current.navy : '#2f4873';
            const grey = detail ? grads.current.grey : '#9ca3af';
            const family = font.current;
            const fit = (text, size, weight, max) => {
                const key = `${weight}${size}|${text}`;
                let out = textFit.current.get(key);
                if (out === undefined) {
                    ctx.font = `${weight} ${size}px ${family}`;
                    out = text;
                    if (ctx.measureText(out).width > max) {
                        while (out.length > 1 && ctx.measureText(`${out}…`).width > max) out = out.slice(0, -1);
                        out = `${out}…`;
                    }
                    textFit.current.set(key, out);
                }
                return out;
            };
            const figures = figureShapes();

            for (const c of T.cards) {
                if (c.x + c.w < x0 || c.x > x1 || c.y + c.h < y0 || c.y > y1) continue;
                ctx.setTransform(a, 0, 0, a, e, f);
                if (detail === 2) {
                    ctx.fillStyle = 'rgba(15,23,42,0.08)'; // soft shadow
                    rounded(ctx, c.x, c.y + 2, c.w, c.h, 12);
                    ctx.fill();
                }
                ctx.fillStyle = '#fff';
                rounded(ctx, c.x, c.y, c.w, c.h, detail ? 12 : 6);
                ctx.fill();
                if (detail === 2) {
                    ctx.strokeStyle = '#e2e8f0';
                    ctx.lineWidth = 1;
                    ctx.stroke();
                }
                for (const p of c.tiles) {
                    // Hovered (desktop): a touch bigger, like before.
                    const k = hover.current === p.id ? 1.04 : 1;
                    const px = p.x - (TILE_W / 2) * (k - 1);
                    const py = p.y - (th / 2) * (k - 1);
                    const ak = a * k;
                    ctx.setTransform(ak, 0, 0, ak, e + px * a, f + py * a);
                    ctx.fillStyle = p.late ? grey : navy;
                    rounded(ctx, 0, 0, TILE_W, th, detail ? 8 : 4);
                    ctx.fill();
                    if (p.isRoot) {
                        // orange ring with a 1px white gap
                        ctx.lineWidth = 2;
                        ctx.strokeStyle = '#fff';
                        rounded(ctx, -1, -1, TILE_W + 2, th + 2, 9);
                        ctx.stroke();
                        ctx.lineWidth = Math.max(1.5, 2 / (s * k));
                        ctx.strokeStyle = '#f79812';
                        rounded(ctx, -2.75, -2.75, TILE_W + 5.5, th + 5.5, 10.5);
                        ctx.stroke();
                    }
                    if (!detail) continue;
                    // The figure fills the tile (48px, 3px from the top).
                    ctx.setTransform(ak * 0.75, 0, 0, ak * 0.75, e + px * a + 4 * ak, f + py * a + 3 * ak);
                    ctx.fillStyle = 'rgba(255,255,255,0.9)';
                    if (p.female) {
                        ctx.globalAlpha = 0.85;
                        ctx.fill(figures.hair);
                        ctx.globalAlpha = 1;
                    }
                    for (const part of p.female ? figures.woman : figures.man) ctx.fill(part);
                    ctx.setTransform(ak, 0, 0, ak, e + px * a, f + py * a);
                    if (p.late) {
                        // flower badge, top-right
                        ctx.fillStyle = 'rgba(255,255,255,0.9)';
                        ctx.beginPath();
                        ctx.arc(TILE_W - 9, 9, 7, 0, Math.PI * 2);
                        ctx.fill();
                        ctx.fillStyle = '#6b7280';
                        ctx.beginPath();
                        for (let i = 0; i < 5; i++) {
                            const r = (i * 2 * Math.PI) / 5 - Math.PI / 2;
                            ctx.moveTo(TILE_W - 9 + Math.cos(r) * 2.4 + 1.5, 9 + Math.sin(r) * 2.4);
                            ctx.arc(TILE_W - 9 + Math.cos(r) * 2.4, 9 + Math.sin(r) * 2.4, 1.5, 0, Math.PI * 2);
                        }
                        ctx.fill();
                        ctx.fillStyle = '#fff';
                        ctx.beginPath();
                        ctx.arc(TILE_W - 9, 9, 1.1, 0, Math.PI * 2);
                        ctx.fill();
                    }
                    if (detail < 2) continue;
                    ctx.textAlign = 'center';
                    ctx.textBaseline = 'middle';
                    ctx.fillStyle = '#fff';
                    ctx.font = `500 10px ${family}`;
                    ctx.fillText(fit(p.name, 10, 500, TILE_W - 8), TILE_W / 2, 55.5);
                    if (th > 70) {
                        ctx.font = `400 9px ${family}`;
                        ctx.fillStyle = 'rgba(255,255,255,0.8)';
                        if (p.line1) ctx.fillText(fit(p.line1, 9, 400, TILE_W - 8), TILE_W / 2, 67.5);
                        if (p.line2) {
                            ctx.font = `600 9px ${family}`;
                            ctx.fillStyle = '#fed7aa';
                            ctx.fillText(fit(p.line2, 9, 600, TILE_W - 8), TILE_W / 2, 79.5);
                        }
                    }
                }
            }
        };
    });

    // New layout (switches, language): keep the person's card where it was on screen.
    useEffect(() => {
        const before = layout.current.root;
        layout.current = L;
        const after = L.root;
        const { s, tx, ty } = cam.current;
        if (before && after && before !== after) setCam(s, tx + (before.x - after.x) * s, ty + (before.y - after.y) * s);
        else invalidate();
        // setCam / invalidate only read refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [L]);

    // Canvas size = the box (never the whole tree): re-measured on resize, sharp on high-density screens (max 2×).
    useEffect(() => {
        const el = box.current;
        const cv = canvas.current;
        font.current = getComputedStyle(cv).fontFamily || 'sans-serif';
        let first = true;
        const fit = () => {
            const dpr = Math.min(window.devicePixelRatio || 1, 2);
            const w = el.clientWidth;
            const h = el.clientHeight;
            view.current = { w, h, dpr };
            cv.width = Math.round(w * dpr);
            cv.height = Math.round(h * dpr);
            if (first && w) {
                first = false;
                centerOnRoot(); // open on the person whose tree this is
            } else paint.current();
        };
        fit();
        const ro = new ResizeObserver(fit);
        ro.observe(el);
        // Names are measured with the page font — measure again once it has loaded.
        document.fonts?.ready.then(() => {
            textFit.current.clear();
            invalidate();
        });
        // Pinch on a trackpad / Ctrl + wheel zooms; plain wheel moves (non-passive, so the page doesn't scroll instead).
        const onWheel = (e) => {
            e.preventDefault();
            if (hover.current) {
                // the bubble would be left behind
                hover.current = null;
                cv.style.cursor = '';
                setTip(null);
            }
            const [x, y] = local(e);
            const unit = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? el.clientHeight : 1;
            if (e.ctrlKey) return zoomAt(cam.current.s * Math.exp(-e.deltaY * unit * 0.01), x, y);
            const { s, tx, ty } = cam.current;
            setCam(s, tx - (e.shiftKey ? e.deltaY : e.deltaX) * unit, ty - (e.shiftKey ? 0 : e.deltaY) * unit);
        };
        el.addEventListener('wheel', onWheel, { passive: false });
        return () => {
            ro.disconnect();
            el.removeEventListener('wheel', onWheel);
            cancelAnimationFrame(frame.current);
            frame.current = 0;
        };
        // Bound once; everything it calls reads refs.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const setHover = (p) => {
        const id = p?.id ?? null;
        if (hover.current === id) return;
        hover.current = id;
        canvas.current.style.cursor = id ? 'pointer' : '';
        if (p) {
            showTip(p);
            router.prefetch(`/members/${id}`);
        } else setTip(null);
        invalidate();
    };

    const onPointerDown = (e) => {
        if (e.pointerType === 'mouse' && e.button !== 0) return;
        canvas.current.focus({ preventScroll: true });
        canvas.current.setPointerCapture?.(e.pointerId);
        pointers.current.set(e.pointerId, local(e));
        if (pointers.current.size === 2) {
            // Second finger down: switch from dragging to pinching.
            const [p, q] = [...pointers.current.values()];
            pinch.current = { dist: Math.hypot(p[0] - q[0], p[1] - q[1]) || 1, s: cam.current.s };
            clearTimeout(drag.current?.timer);
            drag.current = { ...(drag.current ?? {}), moved: true };
            setTip(null);
            return;
        }
        const [x, y] = local(e);
        const d = { x, y, tx: cam.current.tx, ty: cam.current.ty, moved: false, long: false };
        // Phone: hold a card for its name · relation · age.
        if (e.pointerType !== 'mouse')
            d.timer = setTimeout(() => {
                const p = !d.moved && hitTest(x, y);
                if (!p) return;
                d.long = true;
                showTip(p);
            }, 450);
        drag.current = d;
        if (e.pointerType !== 'mouse') setTip(null);
    };
    const onPointerMove = (e) => {
        if (!pointers.current.has(e.pointerId)) {
            if (e.pointerType === 'mouse') setHover(hitTest(...local(e)));
            return;
        }
        pointers.current.set(e.pointerId, local(e));
        if (pinch.current && pointers.current.size >= 2) {
            const [p, q] = [...pointers.current.values()];
            const dist = Math.hypot(p[0] - q[0], p[1] - q[1]) || 1;
            zoomAt(pinch.current.s * (dist / pinch.current.dist), (p[0] + q[0]) / 2, (p[1] + q[1]) / 2);
            return;
        }
        const d = drag.current;
        if (!d) return;
        const [x, y] = local(e);
        if (!d.moved && Math.abs(x - d.x) + Math.abs(y - d.y) > 5) {
            d.moved = true;
            clearTimeout(d.timer);
            setHover(null);
        }
        if (d.moved) setCam(cam.current.s, d.tx + x - d.x, d.ty + y - d.y);
    };
    const onPointerEnd = (e) => {
        if (!pointers.current.delete(e.pointerId)) return;
        if (pointers.current.size < 2) pinch.current = null;
        if (pointers.current.size > 0) return; // still a finger down
        const d = drag.current;
        drag.current = null;
        if (!d) return;
        clearTimeout(d.timer);
        if (d.moved || d.long || e.type === 'pointercancel') return;
        // A tap (not a drag, pinch or long-press) opens the card; Ctrl / ⌘ in a new tab.
        const p = hitTest(...local(e));
        if (!p) return;
        const href = `/members/${p.id}`;
        if (e.ctrlKey || e.metaKey) window.open(href, '_blank', 'noopener');
        else router.push(href);
    };
    const onKeyDown = (e) => {
        const { s, tx, ty } = cam.current;
        const { w, h } = view.current;
        const moves = { ArrowLeft: [80, 0], ArrowRight: [-80, 0], ArrowUp: [0, 80], ArrowDown: [0, -80] };
        if (moves[e.key]) setCam(s, tx + moves[e.key][0], ty + moves[e.key][1]);
        else if (e.key === '+' || e.key === '=') zoomAt(s * 1.25, w / 2, h / 2);
        else if (e.key === '-' || e.key === '_') zoomAt(s / 1.25, w / 2, h / 2);
        else if (e.key === '0') centerOnRoot(true);
        else return;
        e.preventDefault();
    };

    return (
        <div>
            <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <p className="flex items-center gap-3 text-xs text-ink-gray">
                    <span className="inline-flex items-center gap-1">
                        <ManIcon className="size-4 text-brand-navy" /> {t('gender.male')}
                    </span>
                    <span className="inline-flex items-center gap-1">
                        <WomanIcon className="size-4 text-brand-navy" /> {t('gender.female')}
                    </span>
                    <span className="hidden sm:inline">· {t('family.gestureHint')}</span>
                </p>
                <div className="flex flex-wrap items-center gap-4">
                    {/* A switch's part of the tree is fetched once — a spinner while it comes. */}
                    {busy && <Loader2 aria-hidden className="size-4 animate-spin text-ink-gray" />}
                    <Switch checked={showMarried} onChange={onMarried} label={t('family.marriedDaughters')} />
                    <Switch checked={showDetails} onChange={onDetails} label={t('members.details')} />
                </div>
            </div>
            <div ref={fill} className="relative h-[calc(100dvh-13rem)] min-h-80">
                <div ref={box} className="relative h-full overflow-hidden rounded-xl border border-surface-border bg-gray-100 shadow-inner">
                    <canvas
                        ref={canvas}
                        tabIndex={0}
                        role="img"
                        aria-label={t('members.familyTree')}
                        onPointerDown={onPointerDown}
                        onPointerMove={onPointerMove}
                        onPointerUp={onPointerEnd}
                        onPointerCancel={onPointerEnd}
                        onPointerLeave={(e) => e.pointerType === 'mouse' && setHover(null)}
                        onKeyDown={onKeyDown}
                        onContextMenu={(e) => e.preventDefault()}
                        className="block size-full cursor-grab touch-none font-sans outline-none select-none active:cursor-grabbing"
                    />
                    {tip && (
                        <div
                            className="pointer-events-none absolute z-10 max-w-60 -translate-x-1/2 -translate-y-full rounded-md bg-brand-navy px-2 py-1 text-center text-xs text-white shadow-md"
                            style={{ left: tip.x, top: tip.y - 6 }}
                        >
                            {tip.text}
                        </div>
                    )}
                </div>
                {/* Back to this person: their card moves to the middle of the box. */}
                <button
                    type="button"
                    onClick={() => centerOnRoot(true)}
                    aria-label={t('family.focusPerson')}
                    title={t('family.focusPerson')}
                    className="absolute bottom-3 right-3 inline-flex size-10 items-center justify-center rounded-lg border border-surface-border bg-white text-primary shadow-md hover:bg-accent"
                >
                    <Focus className="size-5" />
                </button>
            </div>
            {/* Screen readers: everyone in the tree as a plain list of links (the canvas is a picture to them). */}
            <ul className="sr-only">
                {L.people.map((p) => (
                    <li key={p.id}>
                        <Link href={`/members/${p.id}`} prefetch={false} tabIndex={-1}>
                            {p.hover}
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
