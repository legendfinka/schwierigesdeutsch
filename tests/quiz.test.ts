import { describe, expect, it } from 'vitest';
import {
  caseTopicFromQuery,
  filledPrompt,
  pickQuestions,
  questionsFor,
  quizStats,
  quizStatsText,
  recordResult,
  shuffle,
  type QuizCard,
} from '../src/lib/quiz';
import { CASE_TOPIC_IDS } from '../src/lib/case-topics';
import { QuizResultSchema } from '../src/lib/storage';
import { reportUrl } from '../src/lib/site';

// Fixed seed, so failures repeat.
const seeded = (seed = 1) => () => (seed = (seed * 16807) % 2147483647) / 2147483647;
const result = (correct: number, wrong: number, last = 0) => ({ correct, wrong, last });

describe('shuffle', () => {
  it('keeps the same items and leaves the input alone', () => {
    const input = ['a', 'b', 'c', 'd'];
    const out = shuffle(input, seeded());
    expect([...out].sort()).toEqual(input);
    expect(input).toEqual(['a', 'b', 'c', 'd']);
  });
  it('puts an item in every position over many runs', () => {
    const random = seeded(7);
    const seen = new Set<number>();
    for (let i = 0; i < 100; i++) seen.add(shuffle(['x', 'y', 'z'], random).indexOf('x'));
    expect([...seen].sort()).toEqual([0, 1, 2]);
  });
});

describe('filledPrompt', () => {
  it('fills the gap', () => {
    expect(filledPrompt({ prompt: 'Ich sehe ___ Mann.', answer: 'den' })).toBe('Ich sehe den Mann.');
  });
  it('capitalizes an answer at the start', () => {
    expect(filledPrompt({ prompt: '___ Mann liest.', answer: 'der' })).toBe('Der Mann liest.');
  });
});

describe('pickQuestions', () => {
  it('takes untried questions before tried ones', () => {
    const picked = pickQuestions(['a', 'b', 'c'], { a: result(1, 0) }, 2, seeded());
    expect(picked.sort()).toEqual(['b', 'c']);
  });
  it('then the ones missed most, then the oldest', () => {
    const results = { a: result(3, 0, 1), b: result(0, 2, 5), c: result(3, 0, 0) };
    expect(pickQuestions(['a', 'b', 'c'], results)).toEqual(['b', 'c', 'a']);
  });
  it('respects the limit and handles nothing', () => {
    expect(pickQuestions(['a', 'b', 'c'], {}, 1, seeded())).toHaveLength(1);
    expect(pickQuestions([], {})).toEqual([]);
    expect(pickQuestions(['a'], {}, 0)).toEqual([]);
  });
});

describe('recordResult', () => {
  it('counts right and wrong, and stays valid for storage', () => {
    let r = recordResult(undefined, true, 1000.4);
    r = recordResult(r, false, 2000);
    expect(r).toEqual({ correct: 1, wrong: 1, last: 2000 });
    expect(QuizResultSchema.safeParse(recordResult(undefined, false, 1000.6)).success).toBe(true);
  });
});

describe('quizStats', () => {
  it('counts tried questions and the share of right answers', () => {
    const s = quizStats(['a', 'b', 'c'], { a: result(2, 0), b: result(0, 2), z: result(9, 0) });
    expect(s).toEqual({ total: 3, tried: 2, rightPercent: 50 });
    expect(quizStatsText(s)).toBe('2 of 3 tried · 50% right');
  });
  it('shows no percent before any answer', () => {
    expect(quizStatsText(quizStats(['a'], {}))).toBe('0 of 1 tried');
  });
});

describe('topics', () => {
  const card = (id: string, topic: string): QuizCard => ({
    id,
    topic,
    prompt: '___',
    options: ['der', 'den'],
    answer: 'der',
    explanation: 'x',
    hint: null,
    reviewed: true,
  });
  const all = [card('a', 'cases/dative'), card('b', 'cases/nom-acc')];

  it('reads only known topics from the address', () => {
    for (const id of CASE_TOPIC_IDS) expect(caseTopicFromQuery(`?topic=${id}`)).toBe(id);
    expect(caseTopicFromQuery('?topic=nope')).toBeNull();
    expect(caseTopicFromQuery('')).toBeNull();
  });
  it('filters by topic', () => {
    expect(questionsFor(all, 'dative').cards.map((c) => c.id)).toEqual(['a']);
  });
  it('falls back to all when the topic is empty or unknown', () => {
    expect(questionsFor(all, 'wo-wohin')).toMatchObject({ topic: null });
    expect(questionsFor(all, null).cards).toHaveLength(2);
  });
});

describe('reportUrl for quizzes', () => {
  it('says it is a quiz', () => {
    const u = new URL(reportUrl('Ich ___.', 'q-1', 'https://example.test/r', 'quiz'));
    expect(u.searchParams.get('title')).toBe('Mistake in quiz: Ich ___.');
    expect(u.searchParams.get('body')).toContain('Quiz id: q-1');
  });
});
