'use client';
import { Search } from 'lucide-react';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';

/**
 * Everyone, or a hand-picked list (with search) — a meeting's attendees, a Mandal's members.
 * Posts `modeName` = 'all' | 'selected' and, when selected, one `idsName` per chosen person.
 */
export default function PeopleChoice({ people, initialIds, audience = null, error, label, modeName = 'invite', idsName = 'attendee_ids' }) {
    const { t, locale } = useT();
    const all = people.map((p) => p.id);
    // The saved choice wins; older meetings (no choice saved) are read from the list size.
    const [mode, setMode] = useState(audience ?? (initialIds && initialIds.length < all.length ? 'selected' : 'all'));
    const [picked, setPicked] = useState(new Set(initialIds ?? all));
    const [q, setQ] = useState('');
    const name = (p) => (locale !== 'en' && p.full_name_local) || p.full_name;
    const shown = people.filter((p) => !q || name(p).toLowerCase().includes(q.toLowerCase()) || p.full_name.toLowerCase().includes(q.toLowerCase()));
    const toggle = (id) =>
        setPicked((s) => {
            const n = new Set(s);
            n.has(id) ? n.delete(id) : n.add(id);
            return n;
        });

    return (
        <div>
            <p className="mb-1 text-xs font-medium text-ink-gray">{label ?? t('meetings.whoComes')}</p>
            <input type="hidden" name={modeName} value={mode} />
            <div className="inline-flex rounded-md bg-surface-bggray/70 p-0.5">
                {['all', 'selected'].map((m) => (
                    <button
                        key={m}
                        type="button"
                        onClick={() => setMode(m)}
                        className={`h-8 shrink-0 rounded px-3 text-xs font-medium ${mode === m ? 'seg-active shadow-sm' : 'text-ink-gray hover:text-brand-navy'}`}
                    >
                        {m === 'all' ? t('meetings.everyone', { count: people.length }) : t('meetings.choose')}
                    </button>
                ))}
            </div>
            {mode === 'selected' && (
                <div className="mt-2 rounded-md border border-surface-border">
                    <div className="relative border-b border-surface-border">
                        <Search className="pointer-events-none absolute left-2.5 top-1/2 size-3.5 -translate-y-1/2 text-ink-gray" />
                        <input
                            value={q}
                            onChange={(e) => setQ(e.target.value)}
                            placeholder={t('common.search')}
                            className="h-8 w-full rounded-t-md bg-white pl-8 pr-3 text-sm outline-none"
                        />
                    </div>
                    <ul className="max-h-48 overflow-y-auto py-1">
                        {shown.map((p) => (
                            <li key={p.id}>
                                <label className="flex cursor-pointer items-center gap-2 px-3 py-1 text-sm text-primary hover:bg-accent">
                                    <input
                                        type="checkbox"
                                        checked={picked.has(p.id)}
                                        onChange={() => toggle(p.id)}
                                        className="size-4 accent-[var(--color-brand-orange-strong)]"
                                    />
                                    {name(p)}
                                </label>
                            </li>
                        ))}
                    </ul>
                    <p className="border-t border-surface-border px-3 py-1 text-xs text-ink-gray">{t('meetings.chosenCount', { count: picked.size })}</p>
                    {[...picked].map((id) => (
                        <input key={id} type="hidden" name={idsName} value={id} />
                    ))}
                </div>
            )}
            {error && <p className="mt-1 text-xs font-medium text-destructive">{error}</p>}
        </div>
    );
}
