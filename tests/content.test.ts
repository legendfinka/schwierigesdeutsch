import { describe, expect, it } from 'vitest';
import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { ZodTypeAny } from 'zod';
import {
  AnnotatedSentenceSchema,
  NounSchema,
  QuizQuestionSchema,
  type Noun,
  type QuizQuestion,
} from '../src/lib/schemas';
import { REQUIRED_CHECKS, isVisible } from '../src/lib/visibility';
import {
  checkCapitalized,
  checkExampleArticle,
  checkGenderRule,
  checkNounId,
  checkOptionTypes,
  checkSentenceShape,
  findDuplicateNouns,
} from '../src/lib/content-checks';

const CONTENT = join(__dirname, '..', 'src', 'content');

type Entry = { file: string; data: Record<string, unknown> };

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

// Safety net, not a spell check.
const SUBSTITUTES =
  /\b(Maenner|Haeuser|Buecher|Aepfel|Kueche|Schueler|Muetter|Vaeter|fuer|ueber|Strasse|Fuesse|Gruesse)\b/i;

// Ids are ASCII on purpose; verified is meta data.
const visibleText = (data: Record<string, unknown>) =>
  JSON.stringify({ ...data, id: undefined, verified: undefined });

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
      .filter(({ data }) => SUBSTITUTES.test(visibleText(data)))
      .map(({ file, data }) => `${file} [${String(data.id)}]`);
    expect(bad).toEqual([]);
  });
});

// Schema failures are reported above.
function parsed<T>(dir: string, schema: { safeParse: (d: unknown) => { success: boolean; data?: T } }) {
  return load(dir).flatMap(({ file, data }) => {
    const r = schema.safeParse(data);
    return r.success && r.data !== undefined ? [{ file, item: r.data }] : [];
  });
}

const GRAMMAR = join(CONTENT, 'grammar');
const ruleIds = new Set(
  existsSync(GRAMMAR)
    ? readdirSync(GRAMMAR).filter((f) => f.endsWith('.md')).map((f) => f.replace(/\.md$/, ''))
    : [],
);

describe('content/nouns extras', () => {
  const nouns = parsed<Noun>('nouns', NounSchema);

  it('loads nouns (guards against checks passing on an empty list)', () => {
    expect(nouns.length).toBeGreaterThan(0);
    expect(nouns.length).toBe(load('nouns').length);
  });

  it('no verified noun is silently hidden in production', () => {
    const hidden = nouns
      .filter(({ item }) => item.verified !== undefined)
      .filter(({ item }) => !isVisible(item, false, REQUIRED_CHECKS.noun))
      .map(({ file, item }) => `${file} [${item.id}]: verified but missing ${REQUIRED_CHECKS.noun.join(' + ')}`);
    expect(hidden).toEqual([]);
  });

  it('noun and plural are capitalized', () => {
    const bad = nouns.flatMap(({ file, item }) =>
      checkCapitalized(item).map((p) => `${file} [${item.id}]: ${p}`),
    );
    expect(bad).toEqual([]);
  });

  it('ids match the noun', () => {
    const bad = nouns.flatMap(({ file, item }) =>
      checkNounId(item).map((p) => `${file}: ${p}`),
    );
    expect(bad).toEqual([]);
  });

  it('no noun appears twice', () => {
    expect(findDuplicateNouns(nouns.map(({ item }) => item))).toEqual([]);
  });

  it('article before the noun in the example fits its gender', () => {
    const bad = nouns.flatMap(({ file, item }) =>
      checkExampleArticle(item).map((p) => `${file} [${item.id}]: ${p}`),
    );
    expect(bad).toEqual([]);
  });

  it('example sentences start with a capital and end with punctuation', () => {
    const bad = nouns.flatMap(({ file, item }) =>
      checkSentenceShape(item.example).map((p) => `${file} [${item.id}]: ${p}`),
    );
    expect(bad).toEqual([]);
  });

  it('genderRule points to an existing grammar page', () => {
    const bad = nouns.flatMap(({ file, item }) =>
      checkGenderRule(item.genderRule, ruleIds).map((p) => `${file} [${item.id}]: ${p}`),
    );
    expect(bad).toEqual([]);
  });
});

describe('content/quizzes extras', () => {
  const quizzes = parsed<QuizQuestion>('quizzes', QuizQuestionSchema);

  it('options are all the same type', () => {
    const bad = quizzes.flatMap(({ file, item }) =>
      checkOptionTypes(item.options).map((p) => `${file} [${item.id}]: ${p}`),
    );
    expect(bad).toEqual([]);
  });
});
