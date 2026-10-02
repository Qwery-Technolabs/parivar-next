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

/** Term key for a path of steps, or null when there is no common name for it. */
export function kinTerm(steps) {
    if (!steps?.length) return null;
    return KIN_TERMS[steps.join('.')] ?? null;
}
