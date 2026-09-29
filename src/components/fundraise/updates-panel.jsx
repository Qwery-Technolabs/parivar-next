import { Trash2 } from 'lucide-react';
import { deleteUpdate } from '@/app/actions/fundraise';
import Badge from '@/components/ui/badge';
import { date, time } from '@/lib/format';
import ActionButton from './action-button';

/** One post. Authors may delete their own; managers any (the action re-checks). */
export function UpdateItem({ u, campaignId, perms, userId, t, locale, compact = false }) {
    const author = (locale === 'gu' && u.author_local) || u.author || '—';
    const [d, tm] = String(u.created_at).split(' ');
    const canDelete = perms.manage || (perms.post && u.created_by === userId);
    return (
        <li className={compact ? 'rounded-md bg-muted px-3 py-2' : 'rounded-lg border border-surface-border bg-white p-4 shadow-sm'}>
            <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                    {!compact && (
                        <div className="mb-1 flex flex-wrap items-center gap-2">
                            <Badge tone={u.update_type === 'minutes' ? 'navy' : 'blue'}>
                                {u.update_type === 'minutes' ? t('fundraise.minutes') : t('fundraise.update')}
                            </Badge>
                            {u.update_type === 'minutes' && u.meeting_date && (
                                <span className="text-xs text-ink-gray">{t('fundraise.minutesOf', { date: date(u.meeting_date, locale) })}</span>
                            )}
                        </div>
                    )}
                    <p className="text-xs text-ink-gray">
                        <span className="font-medium text-primary">{author}</span> · {date(d, locale)} {tm && time(tm)}
                    </p>
                </div>
                {canDelete && (
                    <ActionButton action={deleteUpdate.bind(null, campaignId, u.id)} confirm={t('fundraise.deleteUpdateConfirm')} icon={<Trash2 className="size-3.5" />} danger>
                        <span className="sr-only">{t('common.delete')}</span>
                    </ActionButton>
                )}
            </div>
            <p className="mt-1.5 whitespace-pre-line text-sm text-ink break-words">{u.body}</p>
        </li>
    );
}

/**
 * Server component: newest-first timeline of earlier updates and minutes (read-only list —
 * new updates are sent in the discussion with "alert everyone" on).
 */
export default function UpdatesPanel({ campaignId, updates, perms, userId, t, locale }) {
    return (
        <div className="space-y-3">
            {updates.length === 0 ? (
                <p className="rounded-lg border border-surface-border bg-white px-4 py-10 text-center text-sm text-ink-gray">{t('fundraise.noUpdates')}</p>
            ) : (
                <ul className="space-y-3">
                    {updates.map((u) => (
                        <UpdateItem key={u.id} u={u} campaignId={campaignId} perms={perms} userId={userId} t={t} locale={locale} />
                    ))}
                </ul>
            )}
        </div>
    );
}
