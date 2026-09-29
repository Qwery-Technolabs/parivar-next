// Pure module — English (Latin) spelling → Gujarati script, phonetically, for names.
//
// English spelling of Indian names is lossy (Kajal/કાજલ and Kanak/કનક are both "a"; Patel
// is ટ but Mehta is ત), so this is a SUGGESTION that fills the Gujarati field and stays
// editable. Common surnames, places and names that rules get wrong are listed in WORDS;
// everything else goes through the rules below.

const WORDS = {
    // surnames
    patel: 'પટેલ', shah: 'શાહ', mehta: 'મહેતા', desai: 'દેસાઈ', bhatt: 'ભટ્ટ', joshi: 'જોષી',
    trivedi: 'ત્રિવેદી', pandya: 'પંડ્યા', parikh: 'પરીખ', parekh: 'પારેખ', modi: 'મોદી',
    thakkar: 'ઠક્કર', prajapati: 'પ્રજાપતિ', chauhan: 'ચૌહાણ', solanki: 'સોલંકી', parmar: 'પરમાર',
    rathod: 'રાઠોડ', vaghela: 'વાઘેલા', makwana: 'મકવાણા', raval: 'રાવલ', dave: 'દવે', vyas: 'વ્યાસ',
    pathak: 'પાઠક', rana: 'રાણા', jadeja: 'જાડેજા', gohil: 'ગોહિલ', chavda: 'ચાવડા', panchal: 'પંચાલ',
    mistry: 'મિસ્ત્રી', soni: 'સોની', gandhi: 'ગાંધી', kanani: 'કાનાણી', thakor: 'ઠાકોર',
    chaudhari: 'ચૌધરી', chaudhary: 'ચૌધરી', amin: 'અમીન', dalal: 'દલાલ', kothari: 'કોઠારી',
    sheth: 'શેઠ', doshi: 'દોશી', bhavsar: 'ભાવસાર', luhar: 'લુહાર', suthar: 'સુથાર', rabari: 'રબારી',
    bharwad: 'ભરવાડ', koli: 'કોળી', vankar: 'વણકર', darji: 'દરજી', kadiya: 'કડિયા', nai: 'નાઈ',
    // castes / sub-castes
    kadva: 'કડવા', leuva: 'લેઉવા', leva: 'લેવા', brahmin: 'બ્રાહ્મણ', vania: 'વાણિયા', lohana: 'લોહાણા',
    // places
    vadnagar: 'વડનગર', unjha: 'ઊંઝા', visnagar: 'વિસનગર', mehsana: 'મહેસાણા', ahmedabad: 'અમદાવાદ',
    surat: 'સુરત', rajkot: 'રાજકોટ', vadodara: 'વડોદરા', baroda: 'વડોદરા', gandhinagar: 'ગાંધીનગર',
    bhavnagar: 'ભાવનગર', jamnagar: 'જામનગર', junagadh: 'જૂનાગઢ', palanpur: 'પાલનપુર', patan: 'પાટણ',
    kheda: 'ખેડા', anand: 'આણંદ', nadiad: 'નડિયાદ', bharuch: 'ભરૂચ', valsad: 'વલસાડ', navsari: 'નવસારી',
    kutch: 'કચ્છ', bhuj: 'ભુજ', gujarat: 'ગુજરાત', mumbai: 'મુંબઈ',
    // first names where short/long "a" or ટ/ડ matter
    kajal: 'કાજલ', krishna: 'કૃષ્ણ', parth: 'પાર્થ', hardik: 'હાર્દિક', raj: 'રાજ', ram: 'રામ',
    kiran: 'કિરણ', geeta: 'ગીતા', gita: 'ગીતા', sita: 'સીતા', seema: 'સીમા', meena: 'મીના',
    hiral: 'હિરલ', bhavesh: 'ભાવેશ', dinesh: 'દિનેશ', ganesh: 'ગણેશ', laxmi: 'લક્ષ્મી', lakshmi: 'લક્ષ્મી',
    vijay: 'વિજય', sanjay: 'સંજય', ajay: 'અજય', jay: 'જય', aarti: 'આરતી', arti: 'આરતી',
    vishal: 'વિશાલ', chirag: 'ચિરાગ', kumar: 'કુમાર', nirali: 'નિરાલી', mahendra: 'મહેન્દ્ર',
    rahul: 'રાહુલ', rajesh: 'રાજેશ', kishan: 'કિશન', prakash: 'પ્રકાશ', vikas: 'વિકાસ',
    akash: 'આકાશ', bharat: 'ભરત', jitendra: 'જીતેન્દ્ર', narendra: 'નરેન્દ્ર', surendra: 'સુરેન્દ્ર',
    devendra: 'દેવેન્દ્ર', amit: 'અમિત', sagar: 'સાગર', kamlesh: 'કમલેશ', hitesh: 'હિતેશ',
    // common words in group / event names
    samaj: 'સમાજ', mandal: 'મંડળ', mandir: 'મંદિર', committee: 'સમિતિ', samiti: 'સમિતિ', trust: 'ટ્રસ્ટ',
    temple: 'મંદિર', meeting: 'મીટિંગ', group: 'ગ્રુપ', and: 'અને', of: '', the: '',
};

// Longest spellings first so "chh" wins over "ch" and "c".
const CONSONANTS = [
    ['ksh', 'ક્ષ'], ['chh', 'છ'], ['gny', 'જ્ઞ'], ['shr', 'શ્ર'],
    ['kh', 'ખ'], ['gh', 'ઘ'], ['ch', 'ચ'], ['jh', 'ઝ'], ['th', 'થ'], ['dh', 'ધ'], ['ph', 'ફ'],
    ['bh', 'ભ'], ['sh', 'શ'],
    ['k', 'ક'], ['g', 'ગ'], ['c', 'ક'], ['j', 'જ'], ['z', 'ઝ'], ['t', 'ત'], ['d', 'દ'], ['n', 'ન'],
    ['p', 'પ'], ['f', 'ફ'], ['b', 'બ'], ['m', 'મ'], ['y', 'ય'], ['r', 'ર'], ['l', 'લ'], ['v', 'વ'],
    ['w', 'વ'], ['s', 'સ'], ['h', 'હ'], ['q', 'ક'], ['x', 'ક્સ'],
];

// [spelling, independent letter, matra]; '' matra = the inherent "a".
const VOWELS = [
    ['aa', 'આ', 'ા'], ['ee', 'ઈ', 'ી'], ['ii', 'ઈ', 'ી'], ['oo', 'ઊ', 'ૂ'], ['uu', 'ઊ', 'ૂ'],
    ['ai', 'ઐ', 'ૈ'], ['au', 'ઔ', 'ૌ'], ['ou', 'ઔ', 'ૌ'],
    ['a', 'અ', ''], ['i', 'ઇ', 'િ'], ['u', 'ઉ', 'ુ'], ['e', 'એ', 'ે'], ['o', 'ઓ', 'ો'],
];

const VIRAMA = '્';
const ANUSVARA = 'ં';

function match(list, word, i) {
    for (const entry of list) if (word.startsWith(entry[0], i)) return entry;
    return null;
}

/**
 * Should consonant `a` join consonant `b` as a conjunct (a + virama + b)? English writes
 * "Vadnagar" for વડનગર — the schwa between d and n is dropped in spelling but spoken —
 * so a conjunct is only formed where Gujarati really clusters: before r/y/v, after r/l/s/sh
 * (reph and common clusters), doubled letters, and a few known pairs.
 */
function joins(a, b) {
    if (['r', 'y', 'v', 'w'].includes(b)) return true;
    if (['r', 'l', 's', 'sh'].includes(a)) return true;
    if (a === b) return true;
    return ['gn', 'kt', 'pt', 'tm', 'dm', 'kn', 'tn', 'shn', 'bd'].includes(a + b);
}

function word(w) {
    const lower = w.toLowerCase();
    if (lower in WORDS) return WORDS[lower];
    let out = '';
    let i = 0;
    let prevConsonant = null; // spelling of the consonant still waiting for its vowel
    while (i < lower.length) {
        const v = match(VOWELS, lower, i);
        if (v) {
            let [spell, independent, matra] = v;
            const atEnd = i + spell.length === lower.length;
            // Name endings: -a is long (Neha નેહા), -i is long (Nirali નિરાલી), -ai is ાઈ (Desai).
            if (prevConsonant && atEnd && spell === 'a') matra = 'ા';
            if (prevConsonant && atEnd && spell === 'i') matra = 'ી';
            if (prevConsonant && atEnd && spell === 'ai') matra = 'ાઈ';
            out += prevConsonant ? matra : independent;
            prevConsonant = null;
            i += spell.length;
            continue;
        }
        const c = match(CONSONANTS, lower, i);
        if (c) {
            const [spell, letter] = c;
            if (prevConsonant) {
                // n/m before another consonant is a nasal: Manthan મંથન, Priyanka પ્રિયંકા.
                if ((prevConsonant === 'n' || prevConsonant === 'm') && !['y', 'r', 'v', 'h'].includes(spell)) {
                    out = out.slice(0, -1) + ANUSVARA;
                } else if (joins(prevConsonant, spell)) {
                    out += VIRAMA;
                }
                // otherwise the previous consonant keeps its inherent "a"
            }
            out += letter;
            prevConsonant = spell;
            i += spell.length;
            continue;
        }
        out += lower[i]; // digits, apostrophes: pass through
        prevConsonant = null;
        i += 1;
    }
    return out;
}

/** Transliterate a whole phrase, keeping spaces and punctuation. */
export function toGujarati(text) {
    return String(text ?? '')
        .split(/([A-Za-z]+)/)
        .map((part) => (/^[A-Za-z]+$/.test(part) ? word(part) : part))
        .join('')
        .replace(/[ \t]{2,}/g, ' ') // spaces only: descriptions are multi-line
        .trim();
}
