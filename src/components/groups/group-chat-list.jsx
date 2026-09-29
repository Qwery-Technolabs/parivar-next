'use client';
import { Search, ShieldCheck } from 'lucide-react';
import Link from 'next/link';
import { useState } from 'react';
import { useT } from '@/lib/i18n/client';

// Avatar tints: every text colour is ≥4.5:1 on its tint, like the badge palette.
const AVATARS = [
    'bg-blue-50 text-blue-800',
    'bg-emerald-50 text-emerald-700',
    'bg-rose-50 text-rose-700',
    'bg-purple-50 text-purple-800',
    'bg-amber-50 text-amber-800',
    'bg-teal-50 text-teal-700',
];

/**
 * WhatsApp-style chat list: avatar, name, last message, time on the right, unread badge.
 * Your groups first (newest activity on top), then the rest. Search filters as you type.
 */
export default function GroupChatList({ groups }) {
    const { t } = useT();
    const [q, setQ] = useState('');
    const shown = q ? groups.filter((g) => g.name.toLowerCase().includes(q.trim().toLowerCase())) : groups;

    if (groups.length === 0) {
        return <p className="rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">{t('groups.empty')}</p>;
    }

    return (
        <div className="overflow-hidden rounded-lg border border-surface-border bg-white shadow-sm">
            <div className="border-b border-surface-border bg-card-head p-2">
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-ink-gray" />
                    <input
                        type="search"
                        value={q}
                        onChange={(e) => setQ(e.target.value)}
                        placeholder={t('groups.searchPlaceholder')}
                        className="h-9 w-full rounded-full border border-surface-border bg-white pl-9 pr-3 text-sm outline-none focus:border-ring focus:ring-2 focus:ring-ring/30"
                    />
                </div>
            </div>
            {shown.length === 0 && <p className="px-4 py-8 text-center text-sm text-ink-gray">{t('common.noResults')}</p>}
            <ul className="divide-y divide-surface-border">
                {shown.map((g) => (
                    <li key={g.id}>
                        <Link href={`/groups/${g.id}`} className="flex items-center gap-3 px-3 py-2.5 hover:bg-accent/60">
                            <span aria-hidden className={`flex size-11 shrink-0 items-center justify-center rounded-full text-base font-semibold ${AVATARS[g.id % AVATARS.length]}`}>
                                {g.name.trim().charAt(0).toUpperCase()}
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="flex items-center gap-1.5">
                                    <span className={`truncate text-sm text-primary ${g.unread ? 'font-bold' : 'font-semibold'}`}>{g.name}</span>
                                    {g.admin && <ShieldCheck aria-label={t('groups.admin')} className="size-3.5 shrink-0 text-brand-orange-strong" />}
                                </span>
                                <span className={`block truncate text-xs ${g.unread ? 'font-medium text-ink' : g.muted ? 'italic text-ink-gray' : 'text-ink-gray'}`}>
                                    {g.preview}
                                </span>
                            </span>
                            <span className="flex shrink-0 flex-col items-end gap-1">
                                <span className={`text-[11px] tabular-nums ${g.unread ? 'font-semibold text-brand-orange-strong' : 'text-ink-gray'}`}>{g.when}</span>
                                {g.unread > 0 ? (
                                    <span className="seg-active flex h-5 min-w-5 items-center justify-center rounded-full px-1.5 text-[11px] font-semibold tabular-nums">
                                        {g.unread > 99 ? '99+' : g.unread}
                                    </span>
                                ) : (
                                    <span className="text-[11px] tabular-nums text-ink-gray">{t('groups.memberCount', { count: g.members })}</span>
                                )}
                            </span>
                        </Link>
                    </li>
                ))}
            </ul>
        </div>
    );
}
