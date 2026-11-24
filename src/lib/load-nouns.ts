// Nouns that may show on this build. Pages only: needs astro:content.
import { getCollection } from 'astro:content';
import type { Noun } from './schemas';
import { REQUIRED_CHECKS, isVisible } from './visibility';

export async function visibleNouns(): Promise<Noun[]> {
  const entries = await getCollection('nouns', ({ data }) =>
    isVisible(data, import.meta.env.DEV, REQUIRED_CHECKS.noun),
  );
  return entries.map((e) => e.data);
}
