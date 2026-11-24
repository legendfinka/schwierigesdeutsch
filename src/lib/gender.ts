import type { Noun } from './schemas';

export type Gender = Noun['gender'];

export const ARTICLE: Record<Gender, string> = { m: 'der', f: 'die', n: 'das', pl: 'die' };

export const GENDER_LABEL: Record<Gender, string> = {
  m: 'masculine',
  f: 'feminine',
  n: 'neuter',
  pl: 'plural',
};

export function pluralText(n: Pick<Noun, 'plural' | 'pluralOnly'>): string {
  if (n.pluralOnly) return 'only plural';
  if (n.plural === null) return 'no plural';
  return `die ${n.plural}`;
}
