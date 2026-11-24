import { describe, expect, it } from 'vitest';
import {
  checkCapitalized,
  checkExampleArticle,
  checkGenderRule,
  checkNounId,
  checkOptionTypes,
  checkSentenceShape,
  findDuplicateNouns,
  slugify,
} from '../src/lib/content-checks';

const noun = (over: Partial<Parameters<typeof checkExampleArticle>[0]>) => ({
  noun: 'Tisch',
  gender: 'm' as const,
  plural: 'Tische',
  example: 'Der Tisch steht in der Küche.',
  ...over,
});

describe('checkExampleArticle', () => {
  it('accepts the right article', () => {
    expect(checkExampleArticle(noun({}))).toEqual([]);
  });
  it('flags a wrong gender article', () => {
    expect(checkExampleArticle(noun({ example: 'Das Tisch steht hier.' }))).toHaveLength(1);
  });
  it('flags a wrong article before an adjective', () => {
    expect(checkExampleArticle(noun({ example: 'Die kleine Tisch steht hier.' }))).toHaveLength(1);
  });
  it('accepts other cases of the right gender', () => {
    expect(checkExampleArticle(noun({ example: 'Ich sehe den Tisch.' }))).toEqual([]);
    expect(checkExampleArticle(noun({ example: 'Das Buch liegt auf dem Tisch.' }))).toEqual([]);
  });
  it('accepts feminine dative/genitive "der"', () => {
    const frau = { noun: 'Frau', gender: 'f' as const, plural: 'Frauen' };
    expect(checkExampleArticle({ ...frau, example: 'Ich helfe der Frau.' })).toEqual([]);
    expect(checkExampleArticle({ ...frau, example: 'Ich helfe dem Frau.' })).toHaveLength(1);
  });
  it('flags "der" before a neuter noun', () => {
    const kind = { noun: 'Kind', gender: 'n' as const, plural: 'Kinder' };
    expect(checkExampleArticle({ ...kind, example: 'Der Kind spielt.' })).toHaveLength(1);
  });
  it('does not mistake a capitalized noun for an adjective ("der Katze Wasser")', () => {
    const wasser = { noun: 'Wasser', gender: 'n' as const, plural: null };
    expect(checkExampleArticle({ ...wasser, example: 'Ich gebe der Katze Wasser.' })).toEqual([]);
    expect(checkExampleArticle({ ...wasser, example: 'Er zeigt dem Mann Wasser.' })).toEqual([]);
  });
  it('does not mistake -e adverbs for adjectives ("die gerne Wasser")', () => {
    const wasser = { noun: 'Wasser', gender: 'n' as const, plural: null };
    expect(checkExampleArticle({ ...wasser, example: 'Die Frau, die gerne Wasser trinkt, lacht.' })).toEqual([]);
  });
  it('is not confused by possessives ("Das ist meine Lampe")', () => {
    const lampe = { noun: 'Lampe', gender: 'f' as const, plural: 'Lampen' };
    expect(checkExampleArticle({ ...lampe, example: 'Das ist meine Lampe.' })).toEqual([]);
  });
  it('looks back over several adjectives', () => {
    const lampe = { noun: 'Lampe', gender: 'f' as const, plural: 'Lampen' };
    expect(checkExampleArticle({ ...lampe, example: 'Das ist die kleine rote Lampe.' })).toEqual([]);
    expect(checkExampleArticle({ ...lampe, example: 'Das ist das kleine rote Lampe.' })).toHaveLength(1);
  });
  it('does not touch the plural form', () => {
    expect(checkExampleArticle(noun({ example: 'Die Tische stehen hier.' }))).toEqual([]);
  });
  it('skips nouns whose plural equals the singular', () => {
    const lehrer = { noun: 'Lehrer', gender: 'm' as const, plural: 'Lehrer' };
    expect(checkExampleArticle({ ...lehrer, example: 'Die Lehrer sind nett.' })).toEqual([]);
  });
});

describe('checkSentenceShape', () => {
  it('accepts a normal sentence', () => {
    expect(checkSentenceShape('Der Apfel ist rot.')).toEqual([]);
  });
  it('flags lowercase start and missing punctuation', () => {
    expect(checkSentenceShape('der Apfel ist rot')).toHaveLength(2);
  });
  it('accepts a closing quote after the punctuation', () => {
    expect(checkSentenceShape('Er sagt: „Komm her!“')).toEqual([]);
    expect(checkSentenceShape('Sie fragt (leise)?')).toEqual([]);
  });
  it('checks the first letter, not the first character', () => {
    expect(checkSentenceShape('„hallo!“')).toHaveLength(1);
    expect(checkSentenceShape('„Hallo!“')).toEqual([]);
  });
  it('accepts a number before the first word', () => {
    expect(checkSentenceShape('2 Äpfel sind rot.')).toEqual([]);
  });
});

describe('checkOptionTypes', () => {
  it('accepts all articles', () => {
    expect(checkOptionTypes(['der', 'die', 'das', 'dem'])).toEqual([]);
  });
  it('accepts articles plus "no article"', () => {
    expect(checkOptionTypes(['der', 'die', '—'])).toEqual([]);
  });
  it('accepts non-article options', () => {
    expect(checkOptionTypes(['Nominativ', 'Akkusativ', 'Dativ', 'Genitiv'])).toEqual([]);
  });
  it('flags a mix', () => {
    expect(checkOptionTypes(['der', 'die', 'Dativ'])).toHaveLength(1);
  });
  it('does not touch adjective-ending quizzes with dash options', () => {
    expect(checkOptionTypes(['–', '-e', '-en', '-er'])).toEqual([]);
    expect(checkOptionTypes(['-', '-e', '-en'])).toEqual([]);
  });
  it('accepts contractions and possessives next to articles', () => {
    expect(checkOptionTypes(['dem', 'im', 'zum', 'keinem'])).toEqual([]);
  });
  it('does not touch pronoun quizzes', () => {
    expect(checkOptionTypes(['er', 'sie', 'es', 'ihr'])).toEqual([]);
  });
});

describe('slugify / checkNounId', () => {
  it('turns umlauts and ß into ASCII', () => {
    expect(slugify('Tür')).toBe('tuer');
    expect(slugify('Straße')).toBe('strasse');
    expect(slugify('Mädchen')).toBe('maedchen');
    expect(slugify('Öl')).toBe('oel');
  });
  it('drops other accents', () => {
    expect(slugify('Café')).toBe('cafe');
    expect(checkNounId({ id: 'cafe', noun: 'Café' })).toEqual([]);
  });
  it('accepts the slug and a homonym suffix', () => {
    expect(checkNounId({ id: 'tuer', noun: 'Tür' })).toEqual([]);
    expect(checkNounId({ id: 'see-m', noun: 'See' })).toEqual([]);
  });
  it('flags a mismatched id', () => {
    expect(checkNounId({ id: 'tur', noun: 'Tür' })).toHaveLength(1);
    expect(checkNounId({ id: 'seem', noun: 'See' })).toHaveLength(1);
  });
});

describe('checkCapitalized', () => {
  it('accepts capitalized forms', () => {
    expect(checkCapitalized({ noun: 'Äpfel', plural: 'Äpfel' })).toEqual([]);
    expect(checkCapitalized({ noun: 'Wasser', plural: null })).toEqual([]);
  });
  it('flags lowercase singular or plural', () => {
    expect(checkCapitalized({ noun: 'tisch', plural: 'tische' })).toHaveLength(2);
  });
});

describe('findDuplicateNouns', () => {
  it('flags the same noun twice', () => {
    const list = [
      { id: 'tisch', noun: 'Tisch', gender: 'm' as const },
      { id: 'tisch-2', noun: 'Tisch', gender: 'm' as const },
    ];
    expect(findDuplicateNouns(list)).toHaveLength(1);
  });
  it('allows same-gender homonyms with different plurals (die Bank)', () => {
    const list = [
      { id: 'bank-sitz', noun: 'Bank', gender: 'f' as const, plural: 'Bänke', translation: { en: 'bench' } },
      { id: 'bank-geld', noun: 'Bank', gender: 'f' as const, plural: 'Banken', translation: { en: 'bank' } },
    ];
    expect(findDuplicateNouns(list)).toEqual([]);
  });
  it('still flags an identical entry', () => {
    const e = { noun: 'Bank', gender: 'f' as const, plural: 'Bänke', translation: { en: 'bench' } };
    expect(findDuplicateNouns([{ id: 'a', ...e }, { id: 'b', ...e }])).toHaveLength(1);
  });
  it('allows the same word with different genders (der/die See)', () => {
    const list = [
      { id: 'see-m', noun: 'See', gender: 'm' as const },
      { id: 'see-f', noun: 'See', gender: 'f' as const },
    ];
    expect(findDuplicateNouns(list)).toEqual([]);
  });
});

describe('checkGenderRule', () => {
  const ids = new Set(['suffix-ung']);
  it('accepts null and known ids', () => {
    expect(checkGenderRule(null, ids)).toEqual([]);
    expect(checkGenderRule('suffix-ung', ids)).toEqual([]);
  });
  it('flags unknown ids', () => {
    expect(checkGenderRule('suffix-heit', ids)).toHaveLength(1);
  });
});
