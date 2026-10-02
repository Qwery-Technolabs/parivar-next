'use client';
import { date, money } from '@/lib/format';
import { useT } from '@/lib/i18n/client';

/**
 * A member's unpaid Mandal schedules, newest first — the last 3, then "+N older":
 * "20 Sep 2026 ₹500 · 21 Aug 2026 ₹500 · 20 Jul 2026 ₹500 (+2 older)".
 * `items`: [{ id, date, amount }] oldest first (lib/mandal unpaidBySchedule).
 */
export default function PendingList({ items = [] }) {
    const { t, locale } = useT();
    if (!items?.length) return null;
    const recent = [...items].reverse().slice(0, 3);
    const older = items.length - recent.length;
    return (
        <p className="text-[11px] text-destructive/90 tabular-nums">
            {t('mandal.pendingSince')}: {recent.map((x) => `${date(x.date, locale)} ${money(x.amount)}`).join(' · ')}
            {older > 0 && <span className="text-ink-gray"> {t('mandal.olderPending', { count: older })}</span>}
        </p>
    );
}
