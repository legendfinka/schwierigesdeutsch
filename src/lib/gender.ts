import type { Noun } from './schemas';

export type Gender = Noun['gender'];

/** Nominative definite article shown with every noun. */
export const ARTICLE: Record<Gender, string> = { m: 'der', f: 'die', n: 'das', pl: 'die' };

/** Plain-English name, for screen readers and legends. */
export const GENDER_LABEL: Record<Gender, string> = {
  m: 'masculine',
  f: 'feminine',
  n: 'neuter',
  pl: 'plural',
};

/** How the plural is shown on a noun card. */
export function pluralText(n: Pick<Noun, 'plural' | 'pluralOnly'>): string {
  if (n.pluralOnly) return 'only plural';
  if (n.plural === null) return 'no plural';
  return `die ${n.plural}`;
}
