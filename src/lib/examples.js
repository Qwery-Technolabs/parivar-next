// Pure module — client and server. Example values for placeholders: the English box shows
// "e.g. Ramesh", its local twin "ઉદા. રમેશ" (Gujarati) or "उदा. रमेश" (Hindi).

const PREFIX = { en: 'e.g.', gu: 'ઉદા.', hi: 'उदा.' };

const EXAMPLES = {
    firstName: { en: 'Ramesh', gu: 'રમેશ', hi: 'रमेश' },
    fatherName: { en: 'Mahesh', gu: 'મહેશ', hi: 'महेश' },
    husbandName: { en: 'Suresh', gu: 'સુરેશ', hi: 'सुरेश' },
    surname: { en: 'Patel', gu: 'પટેલ', hi: 'पटेल' },
    groupName: { en: 'Kanani Parivar - Surat', gu: 'કાનાણી પરિવાર - સુરત', hi: 'कानाणी परिवार - सूरत' },
    fundraise: { en: 'Temple renovation', gu: 'મંદિર જીર્ણોદ્ધાર', hi: 'मंदिर जीर्णोद्धार' },
    mandal: { en: 'Monthly Mandal', gu: 'માસિક મંડળ', hi: 'मासिक मंडल' },
    caste: { en: 'Patel', gu: 'પટેલ', hi: 'पटेल' },
    meeting: { en: 'Yearly meeting', gu: 'વાર્ષિક મીટિંગ', hi: 'वार्षिक मीटिंग' },
};

/**
 * Placeholders for an English field and its local twin.
 * @param {keyof typeof EXAMPLES} key
 * @param {string} [localLang] 'gu' | 'hi'
 * @returns {{ en: string, local: string } | { en: undefined, local: undefined }}
 */
export function examplePlaceholders(key, localLang = 'gu') {
    const ex = EXAMPLES[key];
    if (!ex) return { en: undefined, local: undefined };
    const lang = ex[localLang] ? localLang : 'gu';
    return { en: `${PREFIX.en} ${ex.en}`, local: `${PREFIX[lang]} ${ex[lang]}` };
}
