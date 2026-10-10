import { ChevronDown } from 'lucide-react';
import { historyWhen } from '@/components/fundraise/history-format';

/**
 * A group's own History (About tab, its admins only) — collapsed like a fundraise's. Each line: who did what,
 * when (lib/group-history.js); an edit lists its changed fields, a team change the roles added / removed.
 * @param {{ rows: any[], t: Function, locale: string }} props
 */
export default function GroupHistory({ rows, t, locale }) {
    const nm = (en, local) => (locale !== 'en' && local) || en || t('groups.history.someone');
    const role = (r) => (r ? (r === 'admin' || r === 'sub_admin' || r === 'speaker' || r === 'member' ? t(`groups.roles.${r}`) : t(`groups.team.${r}`)) : '—');
    const line = (h) => {
        const vars = { actor: nm(h.actor, h.actor_local), name: nm(h.person, h.person_local), title: h.detail.title ?? '' };
        switch (h.action) {
            case 'status':
                return t(`groups.history.status.${h.detail.to}`, vars);
            case 'role':
                return t('groups.history.role', { ...vars, from: role(h.detail.from), to: role(h.detail.to) });
            default:
                return t(`groups.history.${h.action}`, vars);
        }
    };
    const field = (c) => t(`groups.history.fields.${c.field}`);
    return (
        <details id="history" className="group min-w-0 scroll-mt-4 rounded-lg border border-surface-border bg-white shadow-sm">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-2 rounded-lg bg-card-head px-3.5 py-2.5 group-open:rounded-b-none group-open:border-b group-open:border-surface-border [&::-webkit-details-marker]:hidden">
                <span className="text-sm font-semibold text-primary">
                    {t('groups.history.title')}
                    {rows.length > 0 && <span className="ml-1.5 text-xs font-normal text-ink-gray tabular-nums">{rows.length}</span>}
                </span>
                <ChevronDown className="size-4 text-ink-gray transition-transform group-open:rotate-180" />
            </summary>
            <div className="p-4">
                <p className="mb-3 text-xs text-ink-gray">{t('groups.history.hint')}</p>
                {rows.length === 0 ? (
                    <p className="text-center text-sm text-ink-gray">{t('groups.history.empty')}</p>
                ) : (
                    <ol className="space-y-3">
                        {rows.map((h) => (
                            <li key={h.id} className="border-l-2 border-surface-border pl-3">
                                <p className="text-sm text-ink break-words">
                                    {line(h)} <span className="text-xs text-ink-gray tabular-nums">· {historyWhen(h.created_at, locale)}</span>
                                </p>
                                {/* An edit: each changed field (values where they are short). */}
                                {h.action === 'edit' &&
                                    (h.detail.changes ?? []).map((c) => (
                                        <p key={c.field} className="text-xs break-words">
                                            <span className="font-medium text-primary">{field(c)}</span>
                                            {'from' in c ? (
                                                <>
                                                    :{' '}
                                                    <span className="text-ink-gray line-through">
                                                        {c.field === 'visibility' ? t(`groups.visibility.${c.from}`) : c.from || '—'}
                                                    </span>{' '}
                                                    →{' '}
                                                    <span className="text-ink">{c.field === 'visibility' ? t(`groups.visibility.${c.to}`) : c.to || '—'}</span>
                                                </>
                                            ) : (
                                                <span className="text-ink-gray"> — {t('groups.history.changed')}</span>
                                            )}
                                        </p>
                                    ))}
                                {/* A team change: main role, and the task roles added / taken away. */}
                                {h.action === 'team' && (
                                    <p className="text-xs break-words text-ink-gray">
                                        {h.detail.from !== h.detail.to && (
                                            <span className="mr-2">
                                                <span className="line-through">{role(h.detail.from)}</span> →{' '}
                                                <span className="text-ink">{role(h.detail.to)}</span>
                                            </span>
                                        )}
                                        {(h.detail.added ?? []).map((r) => (
                                            <span key={`+${r}`} className="mr-2 text-emerald-700">
                                                + {role(r)}
                                            </span>
                                        ))}
                                        {(h.detail.removed ?? []).map((r) => (
                                            <span key={`-${r}`} className="mr-2 text-rose-700">
                                                − {role(r)}
                                            </span>
                                        ))}
                                    </p>
                                )}
                            </li>
                        ))}
                    </ol>
                )}
            </div>
        </details>
    );
}
