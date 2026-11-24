import { describe, expect, it } from 'vitest';
import {
  AnnotatedSentenceSchema,
  NounSchema,
  QuizQuestionSchema,
  Verified,
} from '../src/lib/schemas';
import { isVisible } from '../src/lib/visibility';

describe('Verified', () => {
  const ok = { sources: ['duden', 'dwds'], date: '2026-11-24' };
  it('accepts two sources', () => {
    expect(Verified.safeParse(ok).success).toBe(true);
  });
  it('accepts a native speaker alone', () => {
    expect(Verified.safeParse({ ...ok, sources: ['native-speaker'] }).success).toBe(true);
  });
  it('rejects a single dictionary', () => {
    expect(Verified.safeParse({ ...ok, sources: ['duden'] }).success).toBe(false);
  });
  it('rejects duplicate sources', () => {
    expect(Verified.safeParse({ ...ok, sources: ['duden', 'duden'] }).success).toBe(false);
  });
  it('rejects an unknown source', () => {
    expect(Verified.safeParse({ ...ok, sources: ['duden', 'google'] }).success).toBe(false);
  });
  it('rejects an impossible date', () => {
    expect(Verified.safeParse({ ...ok, date: '2026-02-30' }).success).toBe(false);
  });
  it('rejects a wrong date format', () => {
    expect(Verified.safeParse({ ...ok, date: '24.11.2026' }).success).toBe(false);
  });
});

describe('isVisible', () => {
  it('hides unverified content in production', () => {
    expect(isVisible({}, false)).toBe(false);
  });
  it('shows unverified content in dev', () => {
    expect(isVisible({}, true)).toBe(true);
  });
  it('shows verified content in production', () => {
    expect(isVisible({ verified: { sources: ['duden', 'dwds'] } }, false)).toBe(true);
  });
});

describe('old fields', () => {
  it('rejects leftover needsReview', () => {
    // Strict schemas catch typos and fields from the old format.
    expect(NounSchema.safeParse({ ...nounFixture(), needsReview: false }).success).toBe(false);
  });
});

function nounFixture() {
  return {
    id: 'kind',
    noun: 'Kind',
    gender: 'n',
    plural: 'Kinder',
    level: 'A1',
    translation: { en: 'child' },
    example: 'Das Kind spielt.',
    genderRule: null,
  };
}

const noun = {
  id: 'tisch',
  noun: 'Tisch',
  gender: 'm',
  plural: 'Tische',
  level: 'A1',
  translation: { en: 'table' },
  example: 'Der Tisch steht in der Küche.',
  genderRule: null,
  verified: { sources: ['duden', 'dwds'], date: '2026-11-24' },
};

const quiz = {
  id: 'cases-dat-001',
  topic: 'cases/dative',
  level: 'A2',
  prompt: 'Ich gebe ___ Frau das Buch.',
  options: ['die', 'der', 'den', 'dem'],
  answer: 'der',
  explanation: { en: "The receiver of 'geben' is dative. Feminine dative: die → der." },
  hint: { en: "With 'geben', the person receiving is in which case?" },
};

const sentence = {
  id: 's-0001',
  level: 'A2',
  text: 'Gestern hat der Lehrer dem Schüler das Buch gegeben.',
  translation: { en: 'Yesterday the teacher gave the student the book.' },
  parts: [
    { t: 'Gestern', role: 'extra' },
    { t: 'hat', role: 'verb1' },
    { t: 'der Lehrer', role: 'subject', case: 'nom' },
    { t: 'dem Schüler', role: 'object', case: 'dat' },
    { t: 'das Buch', role: 'object', case: 'acc' },
    { t: 'gegeben', role: 'verb2' },
  ],
};

describe('NounSchema', () => {
  it('accepts a valid noun', () => {
    expect(NounSchema.safeParse(noun).success).toBe(true);
  });
  it('accepts a noun without plural', () => {
    const n = { ...noun, noun: 'Wasser', plural: null, example: 'Das Wasser ist kalt.' };
    expect(NounSchema.safeParse(n).success).toBe(true);
  });
  it('rejects pluralOnly with null plural', () => {
    expect(NounSchema.safeParse({ ...noun, plural: null, pluralOnly: true }).success).toBe(false);
  });
  it('rejects an example that lacks the noun', () => {
    expect(NounSchema.safeParse({ ...noun, example: 'Das ist ein Stuhl.' }).success).toBe(false);
  });
  it('accepts a noun without verified (unverified)', () => {
    expect(NounSchema.safeParse(nounFixture()).success).toBe(true);
  });
  it('rejects an unknown gender', () => {
    expect(NounSchema.safeParse({ ...noun, gender: 'x' }).success).toBe(false);
  });
});

describe('QuizQuestionSchema', () => {
  it('accepts a valid question', () => {
    expect(QuizQuestionSchema.safeParse(quiz).success).toBe(true);
  });
  it('rejects an answer that is not an option', () => {
    expect(QuizQuestionSchema.safeParse({ ...quiz, answer: 'des' }).success).toBe(false);
  });
  it('rejects duplicate options', () => {
    expect(
      QuizQuestionSchema.safeParse({ ...quiz, options: ['die', 'der', 'der', 'dem'] }).success,
    ).toBe(false);
  });
  it('rejects a gap prompt without ___', () => {
    expect(QuizQuestionSchema.safeParse({ ...quiz, prompt: 'Ich gebe der Frau.' }).success).toBe(
      false,
    );
  });
  it('accepts a plain question without ___', () => {
    const q = {
      ...quiz,
      kind: 'question',
      prompt: "Which case follows 'mit'?",
      options: ['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv'],
      answer: 'Dativ',
      explanation: { en: "'mit' always takes the dative." },
    };
    expect(QuizQuestionSchema.safeParse(q).success).toBe(true);
  });
  it('rejects kind "question" with a ___ gap', () => {
    expect(QuizQuestionSchema.safeParse({ ...quiz, kind: 'question' }).success).toBe(false);
  });
  it('rejects a plain-string explanation', () => {
    expect(QuizQuestionSchema.safeParse({ ...quiz, explanation: 'text' }).success).toBe(false);
  });
});

describe('AnnotatedSentenceSchema', () => {
  it('accepts a valid sentence', () => {
    expect(AnnotatedSentenceSchema.safeParse(sentence).success).toBe(true);
  });
  it('rejects an object without a case', () => {
    const parts = sentence.parts.map((p) =>
      p.t === 'das Buch' ? { t: p.t, role: p.role } : p,
    );
    expect(AnnotatedSentenceSchema.safeParse({ ...sentence, parts }).success).toBe(false);
  });
  it('rejects parts that do not match the text', () => {
    const parts = sentence.parts.slice(0, -1);
    expect(AnnotatedSentenceSchema.safeParse({ ...sentence, parts }).success).toBe(false);
  });
});
