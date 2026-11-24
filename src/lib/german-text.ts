// Simple helpers for German example sentences. Heuristics, not a parser.

// Keeps hyphenated words whole (E-Mail).
export const words = (s: string): string[] => s.match(/\p{L}+(?:-\p{L}+)*/gu) ?? [];

export const ARTICLES: ReadonlySet<string> = new Set([
  'der', 'die', 'das', 'den', 'dem', 'des',
  'ein', 'eine', 'einen', 'einem', 'einer', 'eines',
]);

export const CONTRACTIONS: ReadonlySet<string> = new Set([
  'im', 'am', 'zum', 'zur', 'vom', 'beim', 'ins', 'ans', 'aufs', 'ums', 'fürs', 'übers', 'durchs',
]);

const STEMS = [
  'mein', 'dein', 'sein', 'ihr', 'unser', 'euer', 'eur',
  'kein', 'dies', 'jed', 'manch', 'welch', 'solch',
];
const ENDINGS = ['', 'e', 'en', 'em', 'er', 'es'];

// Articles plus mein-, kein-, dies- etc.
export const DETERMINERS: ReadonlySet<string> = new Set([
  ...ARTICLES,
  ...STEMS.flatMap((s) => ENDINGS.map((e) => s + e)),
]);

// des Tisches, meines Bruders
const GENITIVE: ReadonlySet<string> = new Set(['des', 'eines', ...STEMS.map((s) => `${s}es`)]);

// den Kindern, meinen Freunden
const DATIVE_PLURAL: ReadonlySet<string> = new Set(['den', ...STEMS.map((s) => `${s}en`)]);

// -e adverbs that look like adjectives.
const ADVERBS: ReadonlySet<string> = new Set(['gerne', 'heute', 'morgen', 'nie', 'immer', 'oft', 'sehr']);

const ADJECTIVE_ENDING = /(e|en|er|es|em)$/;

// Article before the noun at i, skipping up to 3 adjectives: "die kleine rote Lampe" → "die".
// undefined when unclear.
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

// Whole words only, so "Ei" doesn't match "Eis". Genitive -s and dative plural -n
// count only after the right article.
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
