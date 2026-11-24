/**
 * Extra content checks that a schema can't express. Pure functions, used by
 * tests/content.test.ts. Each returns a list of problems (empty = fine).
 */
import { ARTICLES, CONTRACTIONS, DETERMINERS, leadingDeterminer, words } from './german-text';

type Gender = 'm' | 'f' | 'n' | 'pl';

/**
 * Article forms that can never stand directly before a SINGULAR noun of this gender,
 * in any case. E.g. "das" never goes with a masculine noun, but "der" can go with a
 * feminine one (dative/genitive: "der Frau"), so that is not flagged.
 */
const IMPOSSIBLE: Record<Exclude<Gender, 'pl'>, ReadonlySet<string>> = {
  m: new Set(['die', 'das', 'eine', 'einer']),
  f: new Set(['das', 'den', 'dem', 'des', 'ein', 'einen', 'einem', 'eines']),
  n: new Set(['der', 'die', 'den', 'eine', 'einer', 'einen']),
};

/** Options meaning "no article" (neutral in quiz options). */
const NO_ARTICLE = new Set(['–', '—', '-', '∅', '(none)']);

/**
 * Finds the singular noun in its example sentence and checks the article in front of
 * it (directly, or before up to three adjectives: "die kleine rote Lampe"). Flags only
 * combinations that are wrong in every case, so it never rejects a correct sentence.
 * Heuristic: when the structure is unclear (a capitalized word or a verb in the way)
 * it checks nothing. Known limit: an unlisted adverb ending in -e between article and
 * noun can cause a false alarm; reword the example if that happens.
 */
export function checkExampleArticle(n: {
  noun: string;
  gender: Gender;
  plural: string | null;
  pluralOnly?: boolean;
  example: string;
}): string[] {
  // Same form in singular and plural (der Lehrer / die Lehrer): can't tell which is used.
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

/**
 * Example sentences start with a capital letter and end with . ! ? or …
 * (closing quotes and brackets after the punctuation are fine).
 */
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

/**
 * If any quiz option is a real article (or a contraction like zum), every option must be
 * an article-like word or a "no article" dash. Quizzes without articles are not checked.
 */
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

/** ASCII id from a German word: Tür → tuer, Straße → strasse, Café → cafe. (Ids only.) */
export function slugify(word: string): string {
  return word
    .toLowerCase()
    .replace(/ä/g, 'ae')
    .replace(/ö/g, 'oe')
    .replace(/ü/g, 'ue')
    .replace(/ß/g, 'ss')
    .normalize('NFD')
    .replace(/\p{M}+/gu, '') // other accents: é → e
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

/** Noun id is the slug of the noun, optionally with a suffix for homonyms (see-m). */
export function checkNounId(n: { id: string; noun: string }): string[] {
  const slug = slugify(n.noun);
  if (n.id === slug || n.id.startsWith(`${slug}-`)) return [];
  return [`id "${n.id}" should be "${slug}" (or "${slug}-…")`];
}

/** Singular and plural both start with a capital letter. */
export function checkCapitalized(n: { noun: string; plural: string | null }): string[] {
  const cap = (s: string) => s[0] !== undefined && s[0] === s[0].toUpperCase();
  const problems: string[] = [];
  if (!cap(n.noun)) problems.push(`noun "${n.noun}" must be capitalized`);
  if (n.plural !== null && !cap(n.plural)) problems.push(`plural "${n.plural}" must be capitalized`);
  return problems;
}

/**
 * The same entry must not appear twice. Homonyms (die Bank = bench / bank) are fine when
 * their plural or translation differs.
 */
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

/** A genderRule must name an existing grammar page (src/content/grammar/<id>.md). */
export function checkGenderRule(rule: string | null, ruleIds: ReadonlySet<string>): string[] {
  if (rule === null || ruleIds.has(rule)) return [];
  return [`genderRule "${rule}" has no page src/content/grammar/${rule}.md`];
}
