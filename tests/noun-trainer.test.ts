import { describe, expect, it } from 'vitest';
import {
  advance,
  asksPlural,
  currentEntry,
  finalGrade,
  formatWait,
  gradeCard,
  levelFromQuery,
  nextDueIn,
  pickCards,
  sessionProgress,
  startSession,
  topicFromQuery,
  toTrainerCard,
  type TrainerCard,
} from '../src/lib/noun-trainer';
import { newCard, review, DAY } from '../src/lib/srs';
import { NounSchema } from '../src/lib/schemas';
import { reportUrl } from '../src/lib/site';

const card = (over: Partial<TrainerCard> = {}): TrainerCard => ({
  id: 'mann',
  noun: 'Mann',
  gender: 'm',
  plural: 'Männer',
  pluralOnly: false,
  translation: 'man',
  example: 'Der Mann liest.',
  genderRule: null,
  topic: 'people',
  level: 'A1',
  ...over,
});

const NOW = 1_700_000_000_000;

describe('gradeCard', () => {
  it('right article and plural', () => {
    expect(gradeCard(card(), 'der', 'Männer')).toMatchObject({ correct: true, pluralExact: true });
  });
  it('wrong article is wrong even if the plural is right', () => {
    const r = gradeCard(card(), 'die', 'Männer');
    expect(r).toMatchObject({ articleOk: false, pluralOk: true, correct: false });
  });
  it('wrong plural is wrong even if the article is right', () => {
    const r = gradeCard(card(), 'der', 'Manner');
    expect(r).toMatchObject({ articleOk: true, pluralOk: false, correct: false });
  });
  it('accepts ae but flags it, so the real form is shown', () => {
    const r = gradeCard(card(), 'der', 'Maenner');
    expect(r).toMatchObject({ correct: true, pluralExact: false });
  });
  it('plural-only nouns: article die, no plural asked', () => {
    const leute = card({ noun: 'Leute', gender: 'pl', plural: 'Leute', pluralOnly: true });
    expect(asksPlural(leute)).toBe(false);
    expect(gradeCard(leute, 'die', '')).toMatchObject({ correct: true, pluralOk: null });
    expect(gradeCard(leute, 'der', '').correct).toBe(false);
  });
  it('singular-only nouns: no plural asked', () => {
    const wasser = card({ noun: 'Wasser', gender: 'n', plural: null });
    expect(asksPlural(wasser)).toBe(false);
    expect(gradeCard(wasser, 'das', '')).toMatchObject({ correct: true, pluralOk: null });
  });
});

describe('finalGrade', () => {
  const right = gradeCard(card(), 'der', 'Männer');
  const wrong = gradeCard(card(), 'die', 'Männer');
  it('uses the rating when correct', () => {
    expect(finalGrade(right, 'hard')).toBe('hard');
    expect(finalGrade(right, 'good')).toBe('good');
    expect(finalGrade(right, 'easy')).toBe('easy');
  });
  it('is always wrong when not correct', () => {
    expect(finalGrade(wrong, 'easy')).toBe('wrong');
  });
});

describe('session', () => {
  const ids = ['a', 'b', 'c'];

  it('due cards come before new ones', () => {
    const srs = { c: { ...newCard(NOW - DAY), due: NOW - 1000 } };
    const s = startSession(ids, srs, NOW);
    expect(s.queue.map((e) => e.id)).toEqual(['c', 'a', 'b']);
    expect(s.total).toBe(3);
  });

  it('limits new cards', () => {
    const s = startSession(ids, {}, NOW, 2);
    expect(s.queue.map((e) => e.id)).toEqual(['a', 'b']);
  });

  it('cards not due yet are skipped', () => {
    const srs = { a: review(newCard(NOW), 'good', NOW) };
    expect(startSession(['a'], srs, NOW).queue).toEqual([]);
  });

  it('a right answer moves on and counts as first try', () => {
    const s = advance(startSession(ids, {}, NOW), true);
    expect(s.queue.map((e) => e.id)).toEqual(['b', 'c']);
    expect(s.firstTry).toBe(1);
  });

  it('a wrong answer comes back once, at the end, as a retry', () => {
    let s = startSession(ids, {}, NOW);
    s = advance(s, false);
    expect(s.queue).toEqual([
      { id: 'b', retry: false },
      { id: 'c', retry: false },
      { id: 'a', retry: true },
    ]);
    expect(s.firstTry).toBe(0);
  });

  it('a wrong retry does not come back again', () => {
    let s = startSession(['a'], {}, NOW);
    s = advance(s, false);
    s = advance(s, false);
    expect(currentEntry(s)).toBeUndefined();
  });

  it('a right retry does not count as first try', () => {
    let s = startSession(['a'], {}, NOW);
    s = advance(s, false);
    s = advance(s, true);
    expect(s.firstTry).toBe(0);
    expect(s.queue).toEqual([]);
  });

  it('advancing an empty session changes nothing', () => {
    const s = startSession([], {}, NOW);
    expect(advance(s, true)).toBe(s);
  });
});

describe('nextDueIn', () => {
  it('finds the soonest waiting card', () => {
    const srs = {
      a: { ...newCard(NOW), due: NOW + 5 * 60_000 },
      b: { ...newCard(NOW), due: NOW + 2 * DAY },
    };
    expect(nextDueIn(['a', 'b'], srs, NOW)).toBe(5 * 60_000);
  });
  it('null when nothing is waiting', () => {
    expect(nextDueIn(['a'], {}, NOW)).toBeNull();
    expect(nextDueIn(['a'], { a: { ...newCard(NOW), due: NOW - 1 } }, NOW)).toBeNull();
  });
  it('ignores saved cards that are not in the list', () => {
    expect(nextDueIn(['a'], { z: { ...newCard(NOW), due: NOW + 1000 } }, NOW)).toBeNull();
  });
});

describe('formatWait', () => {
  it('uses minutes, hours, days', () => {
    expect(formatWait(10 * 60_000)).toBe('10 minutes');
    expect(formatWait(1000)).toBe('1 minute');
    expect(formatWait(60 * 60_000)).toBe('1 hour');
    expect(formatWait(5 * 3_600_000)).toBe('5 hours');
    expect(formatWait(DAY)).toBe('1 day');
    expect(formatWait(3 * DAY)).toBe('3 days');
  });
});

describe('toTrainerCard', () => {
  const noun = NounSchema.parse({
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
  });
  it('copies the fields and marks what is unchecked', () => {
    expect(toTrainerCard(noun)).toEqual({
      id: 'tisch',
      noun: 'Tisch',
      gender: 'm',
      plural: 'Tische',
      pluralOnly: false,
      translation: 'table',
      example: 'Der Tisch steht in der Küche.',
      genderRule: null,
      topic: 'home',
      level: 'A1',
    });
  });
});

describe('sessionProgress', () => {
  it('counts answered cards and ignores retries', () => {
    let s = startSession(['a', 'b'], {}, NOW);
    expect(sessionProgress(s)).toEqual({ done: 0, total: 2 });
    s = advance(s, false);
    expect(sessionProgress(s)).toEqual({ done: 1, total: 2 });
    s = advance(s, true);
    expect(sessionProgress(s)).toEqual({ done: 2, total: 2 });
    s = advance(s, true);
    expect(sessionProgress(s)).toEqual({ done: 2, total: 2 });
  });
});

describe('levelFromQuery', () => {
  it('reads a known level, case must match', () => {
    expect(levelFromQuery('?level=A2')).toBe('A2');
    expect(levelFromQuery('?level=a2')).toBeNull();
    expect(levelFromQuery('?topic=food')).toBeNull();
  });
});

describe('pickCards', () => {
  const all = [
    card({ id: 'p1', topic: 'people', level: 'A1' }),
    card({ id: 'p2', topic: 'people', level: 'A2' }),
    card({ id: 'f1', topic: 'food', level: 'A1' }),
  ];
  const ids = (p: { cards: TrainerCard[] }) => p.cards.map((c) => c.id);

  it('no filter: everything', () => {
    const p = pickCards(all, null, null);
    expect(ids(p)).toEqual(['p1', 'p2', 'f1']);
    expect(p.levels).toEqual(['A1', 'A2']);
  });
  it('topic and level together', () => {
    const p = pickCards(all, 'people', 'A2');
    expect(ids(p)).toEqual(['p2']);
    expect(p).toMatchObject({ topic: 'people', level: 'A2', levels: ['A1', 'A2'] });
  });
  it('level only', () => {
    expect(ids(pickCards(all, null, 'A1'))).toEqual(['p1', 'f1']);
  });
  it('levels are those of the shown topic', () => {
    expect(pickCards(all, 'food', null).levels).toEqual(['A1']);
  });
  it('a level the topic does not have falls back to the whole topic', () => {
    const p = pickCards(all, 'food', 'B1');
    expect(ids(p)).toEqual(['f1']);
    expect(p).toMatchObject({ topic: 'food', level: null });
  });
  it('an empty topic falls back to everything', () => {
    const p = pickCards(all, 'time', null);
    expect(ids(p)).toEqual(['p1', 'p2', 'f1']);
    expect(p.topic).toBeNull();
  });
});

describe('topicFromQuery', () => {
  it('reads a known topic', () => {
    expect(topicFromQuery('?topic=food')).toBe('food');
  });
  it('unknown, empty or missing means all', () => {
    expect(topicFromQuery('?topic=nope')).toBeNull();
    expect(topicFromQuery('?topic=')).toBeNull();
    expect(topicFromQuery('')).toBeNull();
    expect(topicFromQuery('?topic=__proto__')).toBeNull();
  });
});

describe('reportUrl', () => {
  it('prefills the issue with the noun and escapes it', () => {
    const u = new URL(reportUrl('Tisch & Co', 'tisch', 'https://example.test/r'));
    expect(u.origin + u.pathname).toBe('https://example.test/r/issues/new');
    expect(u.searchParams.get('title')).toBe('Mistake in noun: Tisch & Co');
    expect(u.searchParams.get('body')).toContain('Noun id: tisch');
  });
});
