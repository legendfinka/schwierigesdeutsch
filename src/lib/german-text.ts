/**
 * Small, dependency-free helpers for looking at German example sentences.
 * Heuristics, not a parser: they must never reject a correct sentence silently,
 * so when the structure is unclear they return "unknown" (undefined).
 */

/** Words incl. hyphenated ones (E-Mail, Nord-Süd). */
export const words = (s: string): string[] => s.match(/\p{L}+(?:-\p{L}+)*/gu) ?? [];

export const ARTICLES: ReadonlySet<string> = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
]);

/** Contractions of preposition + article. */
export const CONTRACTIONS: ReadonlySet<string> = new Set([
  'im', 'am', 'zum', 'zur', 'vom', 'beim', 'ins', 'ans', 'aufs', 'ums', 'fürs', 'übers', 'durchs',
]);

const STEMS = [
  'mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'eur',
  'kein', 'dies', 'jed', 'manch', 'welch', 'solch',
];
const ENDINGS = ['', 'e', 'en', 'em', 'er', 'es'];

/** Articles and article-like words (possessives, kein-, dies-, jed- …). */
export const DETERMINERS: ReadonlySet<string> = new Set([
  ...ARTICLES,
  ...STEMS.flatMap((s) => ENDINGS.map((e) => s + e)),
]);

/** Determiners that stand before a genitive noun: des Tisches, eines Kindes, meines Bruders. */
const GENITIVE: ReadonlySet<string> = new Set(['des', 'eines', ...STEMS.map((s) => `${s}es`)]);

/** Determiners that stand before a dative plural: den Kindern, meinen Freunden. */
const DATIVE_PLURAL: ReadonlySet<string> = new Set(['den', ...STEMS.map((s) => `${s}en`)]);

/** Common adverbs that end in -e and must not be mistaken for adjectives. */
const ADVERBS: ReadonlySet<string> = new Set(['gerne', 'heute', 'morgen', 'nie', 'immer', 'oft', 'sehr']);

const ADJECTIVE_ENDING = /(e|en|er|es|em)$/;

/**
 * The article/determiner that governs the noun at index `i`, looking back over up to
 * three lowercase adjective-like words ("die kleine rote Lampe" → "die").
 * Returns undefined when unclear: a capitalized word (a noun or the start of the
 * sentence), a verb, or anything else stands in the way.
 */
export function leadingDeterminer(w: readonly string[], i: number): string | undefined {
  for (let j = i - 1; j >= 0 && j >= i - 4; j--) {
    const word = w[j]!;
    const lower = word.toLowerCase();
    if (DETERMINERS.has(lower)) return lower;
    const isLowercase = word === lower;
    if (isLowercase && ADJECTIVE_ENDING.test(word) && !ADVERBS.has(word)) continue;
    return undefined;
  }
  return undefined;
}

/**
 * Does the example contain the noun, in a form the grammar allows?
 * - the singular or plural as written, always;
 * - genitive -s / -es / -ses only after a genitive determiner (des Tisches, des Busses);
 * - dative plural -n only after a dative-plural determiner (den Kindern).
 * Whole words only, so "Ei" does not match "Eis" in "Ich esse Eis."
 */
export function exampleUsesNoun(example: string, noun: string, plural: string | null): boolean {
  const w = words(example);
  return w.some((word, i) => {
    if (word === noun || word === plural) return true;
    const det = leadingDeterminer(w, i);
    if (det === undefined) return false;
    if (GENITIVE.has(det) && [`${noun}s`, `${noun}es`, `${noun}ses`].includes(word)) return true;
    if (plural !== null && DATIVE_PLURAL.has(det) && word === `${plural}n`) return true;
    return false;
  });
}
