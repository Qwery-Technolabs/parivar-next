// Pure module — client and server. Indian number grouping (1,00,000) in both languages;
// digits stay Latin in Gujarati too, since that is what people type into the forms.

const inr = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 });

export function money(n) {
    if (n == null || n === '') return '—';
    return `₹${inr.format(Number(n))}`;
}

export function number(n) {
    return inr.format(Number(n || 0));
}

/**
 * 'YYYY-MM-DD' → "29 Sep 2026" / "29 સપ્ટે 2026". Parsed as a plain date, never through
 * the Date constructor's UTC interpretation, so the 5th never renders as the 4th.
 */
export function date(value, locale = 'en') {
    if (!value) return '—';
    const [y, m, d] = String(value).slice(0, 10).split('-').map(Number);
    if (!y || !m || !d) return '—';
    const dt = new Date(Date.UTC(y, m - 1, d));
    return new Intl.DateTimeFormat(locale === 'gu' ? 'gu-IN' : 'en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
        numberingSystem: 'latn',
    }).format(dt);
}

export function time(value) {
    if (!value) return '';
    const [h, m] = String(value).split(':').map(Number);
    const ampm = h >= 12 ? 'PM' : 'AM';
    return `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')} ${ampm}`;
}

export function age(dob) {
    if (!dob) return null;
    const [y, m, d] = String(dob).split('-').map(Number);
    const now = new Date(Date.now() + 5.5 * 3600 * 1000);
    let a = now.getUTCFullYear() - y;
    if (now.getUTCMonth() + 1 < m || (now.getUTCMonth() + 1 === m && now.getUTCDate() < d)) a--;
    return a >= 0 && a < 130 ? a : null;
}
