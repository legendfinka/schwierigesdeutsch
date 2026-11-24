import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodTypeAny } from 'zod';
import {
  AnnotatedSentenceSchema,
  NounSchema,
  QuizQuestionSchema,
} from '../src/lib/schemas';

const CONTENT = join(__dirname, '..', 'src', 'content');

type Entry = { file: string; data: Record<string, unknown> };

/** Load every entry from all JSON files in a content folder (empty folder = no entries). */
function load(dir: string): Entry[] {
  const path = join(CONTENT, dir);
  if (!existsSync(path)) return [];
  return readdirSync(path)
    .filter((f) => f.endsWith('.json'))
    .flatMap((file) => {
      const parsed: unknown = JSON.parse(readFileSync(join(path, file), 'utf8'));
      const items = Array.isArray(parsed) ? parsed : [parsed];
      return items.map((data) => ({ file, data: data as Record<string, unknown> }));
    });
}

const collections: Array<[string, ZodTypeAny]> = [
  ['nouns', NounSchema],
  ['quizzes', QuizQuestionSchema],
  ['sentences', AnnotatedSentenceSchema],
];

// Common ASCII substitutes for umlauts / ß. A safety net, not a full spell check.
const SUBSTITUTES =
  /\b(Maenner|Haeuser|Buecher|Aepfel|Kueche|Schueler|Muetter|Vaeter|fuer|ueber|Strasse|Fuesse|Gruesse)\b/;

describe.each(collections)('content/%s', (dir, schema) => {
  const entries = load(dir);

  it('all entries match the schema', () => {
    const errors = entries.flatMap(({ file, data }) => {
      const r = schema.safeParse(data);
      return r.success
        ? []
        : [`${file} [${String(data.id)}]: ${JSON.stringify(r.error.issues)}`];
    });
    expect(errors).toEqual([]);
  });

  it('ids are unique', () => {
    const ids = entries.map((e) => e.data.id);
    expect(ids.length).toBe(new Set(ids).size);
  });

  it('uses real umlauts and ß, not ASCII substitutes', () => {
    const bad = entries
      .filter(({ data }) => SUBSTITUTES.test(JSON.stringify(data)))
      .map(({ file, data }) => `${file} [${String(data.id)}]`);
    expect(bad).toEqual([]);
  });
});

describe('content/nouns extras', () => {
  const nouns = load('nouns');

  it('nouns are capitalized', () => {
    const bad = nouns
      .filter(({ data }) => {
        const n = String(data.noun ?? '');
        return n[0] !== n[0]?.toUpperCase();
      })
      .map((e) => String(e.data.id));
    expect(bad).toEqual([]);
  });
});
