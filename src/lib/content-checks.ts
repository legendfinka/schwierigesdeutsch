// Content checks a schema can't express. Each returns a list of problems.
import { ARTICLES, CONTRACTIONS, DETERMINERS, leadingDeterminer, words } from './german-text';

type Gender = 'm' | 'f' | 'n' | 'pl';

// Articles that never fit a singular noun of this gender, in any case.
// "der Frau" is fine (dative), so "der" isn't listed for f.
const IMPOSSIBLE: Record<Exclude<Gender, 'pl'>, ReadonlySet<string>> = {
  m: new Set(['die', 'das', 'eine', 'einer']),
  f: new Set(['das', 'den', 'dem', 'des', 'ein', 'einen', 'einem', 'eines']),
  n: new Set(['der', 'die', 'den', 'eine', 'einer', 'einen']),
};

// "No article" options in quizzes.
const NO_ARTICLE = new Set(['–', '—', '-', '∅', '(none)']);

// Checks the article before the noun in its example. Skips anything unclear.
// An unlisted -e adverb can cause a false alarm: reword the example.
export function checkExampleArticle(n: {
  noun: string;
  gender: Gender;
  plural: string | null;
  pluralOnly?: boolean;
  example: string;
}): string[] {
  // der Lehrer / die Lehrer: can't tell which one is meant.
  if (n.gender === 'pl' || n.pluralOnly || n.plural === n.noun) return [];
  const gender = n.gender;

  const w = words(n.example);
  const problems: string[] = [];
  w.forEach((word, i) => {
    if (word !== n.noun) return;
    const det = leadingDeterminer(w, i);
    if (det !== undefined && IMPOSSIBLE[gender].has(det)) {
      problems.push(`"${det} … ${n.noun}" can't be right for gender ${gender}`);
    }
  });
  return problems;
}

// Capital first letter, ends with . ! ? or … (closing quotes allowed).
export function checkSentenceShape(s: string): string[] {
  const problems: string[] = [];
  const text = s.trim();
  const first = text.match(/\p{L}/u)?.[0];
  if (first === undefined || first === first.toLowerCase() || first !== first.toUpperCase()) {
    problems.push('must start with a capital');
  }
  const core = text.replace(/[“”„"'»«’‘)\]]+$/u, '');
  if (!/[.!?…]$/u.test(core)) problems.push('must end with . ! ? or …');
  return problems;
}

// If one option is an article, all must be.
export function checkOptionTypes(options: string[]): string[] {
  const lower = (o: string) => o.toLowerCase();
  const hasArticle = options.some((o) => ARTICLES.has(lower(o)) || CONTRACTIONS.has(lower(o)));
  if (!hasArticle) return [];
  const odd = options.filter(
    (o) =>
      !DETERMINERS.has(lower(o)) && !CONTRACTIONS.has(lower(o)) && !NO_ARTICLE.has(o),
  );
  return odd.length > 0 ? [`mixes articles with other options: ${odd.join(', ')}`] : [];
}

// Tür → tuer, Straße → strasse, Café → cafe. For ids only.
export function slugify(word: string): string {
  return word
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '') // é → e
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

// Suffix allowed for homonyms: see-m.
export function checkNounId(n: { id: string; noun: string }): string[] {
  const slug = slugify(n.noun);
  if (n.id === slug || n.id.startsWith(`${slug}-`)) return [];
  return [`id "${n.id}" should be "${slug}" (or "${slug}-…")`];
}

export function checkCapitalized(n: { noun: string; plural: string | null }): string[] {
  const cap = (s: string) => s[0] !== undefined && s[0] === s[0].toUpperCase();
  const problems: string[] = [];
  if (!cap(n.noun)) problems.push(`noun "${n.noun}" must be capitalized`);
  if (n.plural !== null && !cap(n.plural)) problems.push(`plural "${n.plural}" must be capitalized`);
  return problems;
}

// Homonyms like die Bank (bench / bank) are fine if plural or translation differ.
export function findDuplicateNouns(
  nouns: Array<{
    id: string;
    noun: string;
    gender: Gender;
    plural?: string | null;
    translation?: { en: string };
  }>,
): string[] {
  const seen = new Map<string, string>();
  const problems: string[] = [];
  for (const n of nouns) {
    const key = [n.gender, n.noun, n.plural ?? '', n.translation?.en ?? ''].join('|');
    const first = seen.get(key);
    if (first) problems.push(`"${n.noun}" appears twice: ${first}, ${n.id}`);
    else seen.set(key, n.id);
  }
  return problems;
}

// Must match src/content/grammar/<id>.md.
export function checkGenderRule(rule: string | null, ruleIds: ReadonlySet<string>): string[] {
  if (rule === null || ruleIds.has(rule)) return [];
  return [`genderRule "${rule}" has no page src/content/grammar/${rule}.md`];
}
