// Pure module — client and server.
//
// Stored form (users_list.phone, blood / matrimony contact_phone, VARCHAR(16)):
//   India            10 digits, no code          "9825012345"
//   any other place  "+" + country code + number "+12025550123"
// The "+" keeps the two apart: without it a Singapore number (+65 8…) would read as an Indian 10-digit one.

/**
 * Countries for the phone code picker and the member's Country — India first, then where the Samaj's
 * families mostly live abroad, then A–Z. `dial` = calling code; `gu` = Gujarati name.
 */
export const COUNTRIES = [
    { code: 'IN', dial: '91', name: 'India', gu: 'ભારત' },
    { code: 'US', dial: '1', name: 'USA', gu: 'અમેરિકા' },
    { code: 'CA', dial: '1', name: 'Canada', gu: 'કેનેડા' },
    { code: 'GB', dial: '44', name: 'United Kingdom', gu: 'યુકે' },
    { code: 'AU', dial: '61', name: 'Australia', gu: 'ઑસ્ટ્રેલિયા' },
    { code: 'NZ', dial: '64', name: 'New Zealand', gu: 'ન્યૂઝીલેન્ડ' },
    { code: 'AE', dial: '971', name: 'UAE', gu: 'યુએઈ' },
    { code: 'SA', dial: '966', name: 'Saudi Arabia', gu: 'સાઉદી અરેબિયા' },
    { code: 'QA', dial: '974', name: 'Qatar', gu: 'કતાર' },
    { code: 'OM', dial: '968', name: 'Oman', gu: 'ઓમાન' },
    { code: 'KW', dial: '965', name: 'Kuwait', gu: 'કુવૈત' },
    { code: 'BH', dial: '973', name: 'Bahrain', gu: 'બહેરીન' },
    { code: 'SG', dial: '65', name: 'Singapore', gu: 'સિંગાપોર' },
    { code: 'MY', dial: '60', name: 'Malaysia', gu: 'મલેશિયા' },
    { code: 'HK', dial: '852', name: 'Hong Kong', gu: 'હોંગકોંગ' },
    { code: 'KE', dial: '254', name: 'Kenya', gu: 'કેન્યા' },
    { code: 'TZ', dial: '255', name: 'Tanzania', gu: 'ટાન્ઝાનિયા' },
    { code: 'UG', dial: '256', name: 'Uganda', gu: 'યુગાન્ડા' },
    { code: 'ZA', dial: '27', name: 'South Africa', gu: 'દક્ષિણ આફ્રિકા' },
    { code: 'MU', dial: '230', name: 'Mauritius', gu: 'મોરેશિયસ' },
    { code: 'BD', dial: '880', name: 'Bangladesh', gu: 'બાંગ્લાદેશ' },
    { code: 'BE', dial: '32', name: 'Belgium', gu: 'બેલ્જિયમ' },
    { code: 'CN', dial: '86', name: 'China', gu: 'ચીન' },
    { code: 'FR', dial: '33', name: 'France', gu: 'ફ્રાન્સ' },
    { code: 'DE', dial: '49', name: 'Germany', gu: 'જર્મની' },
    { code: 'IE', dial: '353', name: 'Ireland', gu: 'આયર્લેન્ડ' },
    { code: 'IT', dial: '39', name: 'Italy', gu: 'ઇટાલી' },
    { code: 'JP', dial: '81', name: 'Japan', gu: 'જાપાન' },
    { code: 'NP', dial: '977', name: 'Nepal', gu: 'નેપાળ' },
    { code: 'NL', dial: '31', name: 'Netherlands', gu: 'નેધરલેન્ડ' },
    { code: 'PT', dial: '351', name: 'Portugal', gu: 'પોર્ટુગલ' },
    { code: 'LK', dial: '94', name: 'Sri Lanka', gu: 'શ્રીલંકા' },
    { code: 'SE', dial: '46', name: 'Sweden', gu: 'સ્વીડન' },
    { code: 'CH', dial: '41', name: 'Switzerland', gu: 'સ્વિટ્ઝર્લેન્ડ' },
];
export const COUNTRY_CODES = COUNTRIES.map((c) => c.code);
export const countryName = (code, locale = 'en') => {
    const c = COUNTRIES.find((x) => x.code === code);
    return c ? (locale !== 'en' && c.gu) || c.name : '';
};
// Calling codes, longest first (so +971 is not read as +9…); one country per code for display.
const DIALS = [...new Set(COUNTRIES.map((c) => c.dial))].sort((a, b) => b.length - a.length);

/**
 * Normalise to the stored form (see above), or null when it cannot be a phone number.
 * With a country code ("+…" / "00…"): +91 → the 10 Indian digits, anything else → "+<digits>" (8–15 digits).
 * Without one: an Indian number ("98250 12345", "098250 12345", "91 98250 12345"); 11–15 digits are read as
 * already carrying a country code.
 */
export function normalizePhone(input) {
    const raw = String(input ?? '').trim();
    let d = raw.replace(/\D/g, '');
    const withCode = raw.startsWith('+') || raw.startsWith('00');
    if (raw.startsWith('00')) d = d.slice(2);
    if (withCode) {
        if (d.startsWith('91')) return d.length === 12 && /^[6-9]/.test(d.slice(2)) ? d.slice(2) : null;
        return d.length >= 8 && d.length <= 15 ? `+${d}` : null;
    }
    if (d.length === 12 && d.startsWith('91')) d = d.slice(2);
    else if (d.length === 11 && d.startsWith('0')) d = d.slice(1);
    if (d.length === 10) return /^[6-9]/.test(d) ? d : null;
    return d.length >= 11 && d.length <= 15 ? `+${d}` : null;
}

/** A stored number split for the picker: { dial, national } (India for a 10-digit one or nothing). */
export function splitPhone(p) {
    const s = String(p ?? '');
    if (!s.startsWith('+')) return { dial: '91', national: s };
    const d = s.slice(1);
    const dial = DIALS.find((x) => d.startsWith(x)) ?? '';
    return { dial, national: d.slice(dial.length) };
}

/** For people: "98250 12345" (India) or "+1 2025550123". */
export function formatPhone(p) {
    if (!p) return '';
    if (p.startsWith('+')) {
        const { dial, national } = splitPhone(p);
        return dial ? `+${dial} ${national}` : p;
    }
    return p.length === 10 ? `${p.slice(0, 5)} ${p.slice(5)}` : `+${p}`;
}

/** The number for wa.me links: country code + number, digits only. */
export function waNumber(p) {
    if (!p) return '';
    return p.startsWith('+') ? p.slice(1) : p.length === 10 ? `91${p}` : p;
}

/** The first password of a new login made from a phone number: its digits as people type them (no "+"). */
export function phonePassword(p) {
    return String(p ?? '').replace(/\D/g, '');
}
