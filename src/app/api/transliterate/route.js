import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';

// English → local script suggestions from Google Input Tools (the engine behind Google's
// Gujarati / Hindi keyboards; free, no key). Signed-in users only.
//   GET ?text=Kanani Parivar&lang=gu → { suggestions: ['કણાની પરિવાર', 'કાનાની પરિવાર', …] }
// Word by word: suggestion k uses each word's k-th candidate (or its first, when it has fewer).
// Non-English tokens (digits, punctuation, Gujarati already) pass through as they are.
// On any failure the client keeps its own rule-based spelling (lib/local-language).

const ITC = { gu: 'gu-t-i0-und', hi: 'hi-t-i0-und' };
const MAX_WORDS = 12;
const MAX_SUGGESTIONS = 5;

// Per-instance cache: the same surnames and words come up again and again.
const cache = new Map(); // `${lang}:${word}` → string[]
const CACHE_MAX = 5000;

async function candidates(word, lang) {
    const key = `${lang}:${word.toLowerCase()}`;
    if (cache.has(key)) return cache.get(key);
    const url = `https://inputtools.google.com/request?text=${encodeURIComponent(word)}&itc=${ITC[lang]}&num=${MAX_SUGGESTIONS}&cp=0&cs=1&ie=utf-8&oe=utf-8&app=parivar`;
    const res = await fetch(url, { signal: AbortSignal.timeout(4000), cache: 'no-store' });
    if (!res.ok) throw new Error(`google ${res.status}`);
    const data = await res.json();
    // ["SUCCESS", [[word, [cand1, cand2, …], …]]]
    const list = data?.[0] === 'SUCCESS' && Array.isArray(data[1]?.[0]?.[1]) ? data[1][0][1].filter((s) => typeof s === 'string' && s) : [];
    if (!list.length) throw new Error('google empty');
    if (cache.size >= CACHE_MAX) cache.delete(cache.keys().next().value);
    cache.set(key, list);
    return list;
}

export async function GET(request) {
    const user = await getCurrentUser();
    if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401 });

    const sp = request.nextUrl.searchParams;
    const lang = sp.get('lang') in ITC ? sp.get('lang') : 'gu';
    const text = (sp.get('text') || '').slice(0, 200);
    // Keep the separators, so "Patel, Surat" comes back with its comma and spaces.
    const tokens = text.split(/([A-Za-z]+)/);
    const words = [...new Set(tokens.filter((tk) => /^[A-Za-z]+$/.test(tk)))];
    if (!words.length) return NextResponse.json({ suggestions: [] });
    if (words.length > MAX_WORDS) return NextResponse.json({ error: 'too_long' }, { status: 400 });

    try {
        const lists = new Map(await Promise.all(words.map(async (w) => [w, await candidates(w, lang)])));
        const depth = Math.min(MAX_SUGGESTIONS, Math.max(...[...lists.values()].map((l) => l.length)));
        const suggestions = [];
        for (let k = 0; k < depth; k++) {
            const s = tokens.map((tk) => (lists.has(tk) ? (lists.get(tk)[k] ?? lists.get(tk)[0]) : tk)).join('');
            if (!suggestions.includes(s)) suggestions.push(s);
        }
        return NextResponse.json({ suggestions }, { headers: { 'Cache-Control': 'private, max-age=86400' } });
    } catch (err) {
        console.error('transliterate failed', err.message);
        return NextResponse.json({ error: 'unavailable' }, { status: 502 });
    }
}
