// Pure module — client and server.

/**
 * Normalise to the stored form: digits only, Indian numbers reduced to their 10 digits
 * so "+91 98250 12345", "098250 12345" and "9825012345" are one login.
 * @returns {string|null} null when it cannot be a phone number
 */
export function normalizePhone(input) {
    let d = String(input ?? '').replace(/\D/g, '');
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10) return /^[6-9]/.test(d) ? d : null;
    return d.length >= 11 && d.length <= 15 ? d : null; // international, stored as typed
}

export function formatPhone(p) {
    if (!p) return '';
    return p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : `+${p}`;
}
