// Pure module — client and server. Kinship names from a path of family steps.
// A step is how the next person relates to the previous one:
//   father | mother | son | daughter | husband | wife | brother | sister
// A path (from someone to someone else) is a list of steps; KIN_TERMS names the common ones
// (dictionary keys under `kin.terms`). Longer or unusual paths have no name — the chain says it.

export const KIN_STEPS = ['father', 'mother', 'son', 'daughter', 'husband', 'wife', 'brother', 'sister'];

/** Path (steps joined by '.') → term key. */
export const KIN_TERMS = {
    father: 'father',
    mother: 'mother',
    son: 'son',
    daughter: 'daughter',
    husband: 'husband',
    wife: 'wife',
    brother: 'brother',
    sister: 'sister',
    // grandparents / grandchildren
    'father.father': 'dada',
    'father.mother': 'dadi',
    'mother.father': 'nana',
    'mother.mother': 'nani',
    'son.son': 'pautra',
    'son.daughter': 'pautri',
    'daughter.son': 'dohitra',
    'daughter.daughter': 'dohitri',
    'father.father.father': 'pardada',
    'father.father.mother': 'pardadi',
    // the grandfather's line: his brother is also "Dada", his son a "Kaka", their children cousins
    'father.father.brother': 'dada_bhai',
    'father.father.brother.wife': 'dadi_bhai',
    'father.father.brother.son': 'kaka_cousin',
    'father.father.brother.daughter': 'foi_cousin',
    'father.father.brother.son.son': 'cousin2_m',
    'father.father.brother.son.daughter': 'cousin2_f',
    'father.father.sister': 'foi_dadi',
    // uncles / aunts
    'father.brother': 'kaka',
    'father.brother.wife': 'kaki',
    'father.sister': 'foi',
    'father.sister.husband': 'fuva',
    'mother.brother': 'mama',
    'mother.brother.wife': 'mami',
    'mother.sister': 'masi',
    'mother.sister.husband': 'masa',
    // nephews / nieces
    'brother.son': 'bhatrijo',
    'brother.daughter': 'bhatriji',
    'sister.son': 'bhanej',
    'sister.daughter': 'bhanej_f',
    // cousins
    'father.brother.son': 'cousin_m',
    'father.brother.daughter': 'cousin_f',
    'father.sister.son': 'cousin_m',
    'father.sister.daughter': 'cousin_f',
    'mother.brother.son': 'cousin_m',
    'mother.brother.daughter': 'cousin_f',
    'mother.sister.son': 'cousin_m',
    'mother.sister.daughter': 'cousin_f',
    // in-laws
    'brother.wife': 'bhabhi',
    'sister.husband': 'banevi',
    'son.wife': 'vahu',
    'daughter.husband': 'jamai',
    'wife.father': 'sasra',
    'wife.mother': 'sasu',
    'husband.father': 'sasra',
    'husband.mother': 'sasu',
    'wife.brother': 'salo',
    'wife.sister': 'sali',
    'husband.brother': 'diyar',
    'husband.sister': 'nanand',
    'wife.sister.husband': 'sadu',
    'husband.brother.wife': 'derani',
};

const UP = { father: 1, mother: 1, son: -1, daughter: -1 };
const MALE = new Set(['father', 'son', 'husband', 'brother']);
const SPOUSE = new Set(['husband', 'wife']);

// Distant blood relatives by generation (from the viewer: + above, − below), side and gender.
// Side = the first step: through the father (paternal) or the mother (maternal).
const FAR = {
    3: { paternal: ['pardada_far', 'pardadi_far'], maternal: ['pardada_far', 'pardadi_far'] },
    2: { paternal: ['dada_far', 'dadi_far'], maternal: ['nana_far', 'nani_far'] },
    1: { paternal: ['kaka_far', 'foi_far'], maternal: ['mama_far', 'masi_far'] },
    0: { any: ['bhai_far', 'ben_far'] },
};
// Below: by the target's parent — through a man (brother's line) or a woman (sister's / daughter's line).
const FAR_BELOW = {
    '-1': { male: ['bhatrijo_far', 'bhatriji_far'], female: ['bhanej_far', 'bhanej_f_far'] },
    '-2': { male: ['pautra_far', 'pautri_far'], female: ['dohitra_far', 'dohitri_far'] },
};
// The husband / wife of a distant relative.
const FAR_SPOUSE = {
    kaka_far: 'kaki_far',
    foi_far: 'fuva_far',
    mama_far: 'mami_far',
    masi_far: 'masa_far',
    dada_far: 'dadi_far',
    dadi_far: 'dada_far',
    nana_far: 'nani_far',
    nani_far: 'nana_far',
    pardada_far: 'pardadi_far',
    pardadi_far: 'pardada_far',
    bhai_far: 'bhabhi_far',
    ben_far: 'banevi_far',
};

/**
 * A name for a long blood-line path with no exact entry: "Kaka (distant)" for the father's
 * cousin, "Dadi (distant)" for the grandfather's cousin's wife, "Sister (distant)" for a second
 * cousin … Paths through a marriage (in-laws' relatives) get none, except the spouse at the end.
 */
function farTerm(steps) {
    const last = steps.at(-1);
    if (SPOUSE.has(last)) {
        if (steps.length < 2) return null;
        const base = KIN_TERMS[steps.slice(0, -1).join('.')] ? null : farTerm(steps.slice(0, -1));
        return base ? (FAR_SPOUSE[base] ?? null) : null;
    }
    if (steps.some((s) => SPOUSE.has(s))) return null;
    const gen = steps.reduce((g, s) => g + (UP[s] ?? 0), 0);
    const g = MALE.has(last) ? 0 : 1;
    if (gen >= 0) {
        const row = FAR[gen];
        if (!row) return null;
        return (row.any ?? (steps[0] === 'mother' ? row.maternal : row.paternal))[g];
    }
    const row = FAR_BELOW[String(gen)];
    if (!row || steps.length < 2) return null;
    return row[MALE.has(steps.at(-2)) ? 'male' : 'female'][g];
}

/** Term key for a path of steps: its exact name, else a "distant" one, else null. */
export function kinTerm(steps) {
    if (!steps?.length) return null;
    return KIN_TERMS[steps.join('.')] ?? farTerm(steps);
}
