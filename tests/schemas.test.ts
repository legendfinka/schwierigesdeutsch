import { describe, expect, it } from 'vitest';
import {
  AnnotatedSentenceSchema,
  NounSchema,
  QuizQuestionSchema,
  Verified,
} from '../src/lib/schemas';
import { REQUIRED_CHECKS, isChecked, isVisible } from '../src/lib/visibility';
import { checkExampleArticle } from '../src/lib/content-checks';

describe('Verified', () => {
  const ok = { sources: ['duden', 'dwds'], checked: ['gender', 'plural'], date: '2026-11-24' };
  it('requires a non-empty checked list', () => {
    const { checked: _omit, ...without } = ok;
    expect(Verified.safeParse(without).success).toBe(false);
    expect(Verified.safeParse({ ...ok, checked: [] }).success).toBe(false);
  });
  it('rejects duplicate or unknown checked parts', () => {
    expect(Verified.safeParse({ ...ok, checked: ['gender', 'gender'] }).success).toBe(false);
    expect(Verified.safeParse({ ...ok, checked: ['spelling'] }).success).toBe(false);
  });
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
    expect(isVisible({ verified: { checked: ['gender'] } }, false)).toBe(true);
  });
  it('hides verified content in production if a required part was not checked', () => {
    const data = { verified: { checked: ['gender', 'translation'] } };
    expect(isVisible(data, false, REQUIRED_CHECKS.noun)).toBe(false);
    expect(isVisible(data, true, REQUIRED_CHECKS.noun)).toBe(true);
  });
  it('shows content with all required parts checked', () => {
    const data = { verified: { checked: ['gender', 'plural'] } };
    expect(isVisible(data, false, REQUIRED_CHECKS.noun)).toBe(true);
  });
  it('isChecked reports single parts', () => {
    const data = { verified: { checked: ['gender'] } };
    expect(isChecked(data, 'gender')).toBe(true);
    expect(isChecked(data, 'example')).toBe(false);
    expect(isChecked({}, 'gender')).toBe(false);
  });
});

describe('plural-only and singular-only nouns', () => {
  const leute = {
    id: 'leute',
    noun: 'Leute',
    gender: 'pl',
    plural: 'Leute',
    pluralOnly: true,
    level: 'A1',
    topic: 'people',
    translation: { en: 'people' },
    example: 'Die Leute warten auf den Bus.',
    genderRule: null,
  };
  const milch = {
    id: 'milch',
    noun: 'Milch',
    gender: 'f',
    plural: null,
    singularOnly: true,
    level: 'A1',
    topic: 'food',
    translation: { en: 'milk' },
    example: 'Die Milch ist kalt.',
    genderRule: null,
  };
  it('accepts a plural-only noun (die Leute)', () => {
    expect(NounSchema.safeParse(leute).success).toBe(true);
  });
  it('accepts a singular-only noun (die Milch)', () => {
    expect(NounSchema.safeParse(milch).success).toBe(true);
  });
  it('rejects plural-only without gender "pl"', () => {
    expect(NounSchema.safeParse({ ...leute, gender: 'f' }).success).toBe(false);
  });
  it('rejects gender "pl" without pluralOnly', () => {
    expect(NounSchema.safeParse({ ...leute, pluralOnly: undefined }).success).toBe(false);
  });
  it('rejects plural-only whose plural differs from the noun', () => {
    expect(NounSchema.safeParse({ ...leute, plural: 'Leuten' }).success).toBe(false);
  });
  it('rejects plural: null without singularOnly', () => {
    expect(NounSchema.safeParse({ ...milch, singularOnly: undefined }).success).toBe(false);
  });
  it('rejects singularOnly with a plural', () => {
    expect(NounSchema.safeParse({ ...milch, plural: 'Milche' }).success).toBe(false);
  });
  it('rejects both flags together', () => {
    expect(NounSchema.safeParse({ ...milch, pluralOnly: true }).success).toBe(false);
  });
  it('skips the article check for plural-only nouns', () => {
    expect(checkExampleArticle({ ...leute, gender: 'pl' as const })).toEqual([]);
  });
});

describe('old fields', () => {
  it('rejects leftover needsReview', () => {
    expect(NounSchema.safeParse({ ...nounFixture(), needsReview: false }).success).toBe(false);
  });
  it('requires a known topic', () => {
    const { topic: _omit, ...without } = nounFixture();
    expect(NounSchema.safeParse(without).success).toBe(false);
    expect(NounSchema.safeParse({ ...nounFixture(), topic: 'animals' }).success).toBe(false);
  });
});

function nounFixture() {
  return {
    id: 'kind',
    noun: 'Kind',
    gender: 'n',
    plural: 'Kinder',
    level: 'A1',
    topic: 'people',
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
  topic: 'home',
  translation: { en: 'table' },
  example: 'Der Tisch steht in der Küche.',
  genderRule: null,
  verified: { sources: ['duden', 'dwds'], checked: ['gender', 'plural'], date: '2026-11-24' },
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
    const n = {
      ...noun,
      noun: 'Wasser',
      gender: 'n',
      plural: null,
      singularOnly: true,
      example: 'Das Wasser ist kalt.',
    };
    expect(NounSchema.safeParse(n).success).toBe(true);
  });
  it('rejects pluralOnly with null plural', () => {
    expect(NounSchema.safeParse({ ...noun, plural: null, pluralOnly: true }).success).toBe(false);
  });
  it('rejects a missing plural without singularOnly', () => {
    expect(NounSchema.safeParse({ ...noun, plural: null }).success).toBe(false);
  });
  it('matches the noun as a whole word only', () => {
    const ei = { ...nounFixture(), id: 'ei', noun: 'Ei', plural: 'Eier' };
    expect(NounSchema.safeParse({ ...ei, example: 'Der Eimer ist voll.' }).success).toBe(false);
    expect(NounSchema.safeParse({ ...ei, example: 'Ich esse ein Ei.' }).success).toBe(true);
  });
  it('does not accept "Eis" for "Ei" (genitive -s only after a genitive determiner)', () => {
    const ei = { ...nounFixture(), id: 'ei', noun: 'Ei', plural: 'Eier' };
    expect(NounSchema.safeParse({ ...ei, example: 'Ich esse Eis zum Frühstück.' }).success).toBe(false);
    expect(NounSchema.safeParse({ ...ei, example: 'Ich esse ein Eis.' }).success).toBe(false);
    expect(NounSchema.safeParse({ ...ei, example: 'Die Farbe des Eis ist gelb.' }).success).toBe(true);
  });
  it('accepts doubled-s genitive (des Busses) and -es (des Glases)', () => {
    const bus = { ...nounFixture(), id: 'bus', noun: 'Bus', gender: 'm', plural: 'Busse' };
    expect(NounSchema.safeParse({ ...bus, example: 'Die Tür des Busses ist offen.' }).success).toBe(true);
    const glas = { ...nounFixture(), id: 'glas', noun: 'Glas', gender: 'n', plural: 'Gläser' };
    expect(NounSchema.safeParse({ ...glas, example: 'Der Rand des Glases ist heiß.' }).success).toBe(true);
  });
  it('accepts a genitive after adjectives (des kleinen Tisches)', () => {
    expect(NounSchema.safeParse({ ...noun, example: 'Die Farbe des kleinen Tisches ist braun.' }).success).toBe(true);
  });
  it('matches hyphenated nouns (E-Mail)', () => {
    const mail = { ...nounFixture(), id: 'e-mail', noun: 'E-Mail', gender: 'f', plural: 'E-Mails' };
    expect(NounSchema.safeParse({ ...mail, example: 'Die E-Mail ist kurz.' }).success).toBe(true);
  });
  it('accepts genitive and dative plural forms in the example', () => {
    expect(NounSchema.safeParse({ ...noun, example: 'Die Farbe des Tisches ist braun.' }).success).toBe(true);
    const kind = nounFixture();
    expect(NounSchema.safeParse({ ...kind, example: 'Ich helfe den Kindern.' }).success).toBe(true);
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
  it('rejects a subject that is not nominative', () => {
    const parts = sentence.parts.map((p) => (p.role === 'subject' ? { ...p, case: 'acc' } : p));
    expect(AnnotatedSentenceSchema.safeParse({ ...sentence, parts }).success).toBe(false);
  });
  it('ignores typographic quotes and dashes when matching parts to text', () => {
    const s = {
      id: 's-0002',
      level: 'A2',
      text: 'Er sagt: „Komm her!“ – und geht.',
      translation: { en: 'He says: "Come here!" and leaves.' },
      parts: [
        { t: 'Er', role: 'subject', case: 'nom' },
        { t: 'sagt', role: 'verb1' },
        { t: '„Komm her!“', role: 'clause' },
        { t: 'und', role: 'connector' },
        { t: 'geht', role: 'verb1' },
      ],
    };
    expect(AnnotatedSentenceSchema.safeParse(s).success).toBe(true);
  });
  it('rejects parts that do not match the text', () => {
    const parts = sentence.parts.slice(0, -1);
    expect(AnnotatedSentenceSchema.safeParse({ ...sentence, parts }).success).toBe(false);
  });
});
