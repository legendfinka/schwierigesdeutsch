import { describe, expect, it } from 'vitest';
import {
  AGAIN_DELAY,
  DAY,
  MAX_EASE,
  MAX_INTERVAL,
  MIN_EASE,
  isDue,
  newCard,
  nextItems,
  review,
  type Grade,
} from '../src/lib/srs';
import { SrsStateSchema, type SrsState } from '../src/lib/storage';

const T0 = 1_700_000_000_000;

function run(grades: Grade[], start = newCard(T0)): SrsState {
  let card = start;
  let now = T0;
  for (const g of grades) {
    card = review(card, g, now);
    now = card.due;
  }
  return card;
}

describe('newCard', () => {
  it('starts due now with default ease', () => {
    expect(newCard(T0)).toEqual({ due: T0, interval: 0, ease: 2.5, reps: 0, lapses: 0 });
  });
});

describe('review', () => {
  it('first good answer: 1 day, then 6 days, then interval × ease', () => {
    const one = review(newCard(T0), 'good', T0);
    expect(one).toMatchObject({ interval: 1, reps: 1, due: T0 + DAY });
    const two = review(one, 'good', one.due);
    expect(two).toMatchObject({ interval: 6, reps: 2 });
    const three = review(two, 'good', two.due);
    expect(three.interval).toBe(Math.round(6 * two.ease));
  });

  it('uses the ease from before this answer for the interval', () => {
    const two = run(['good', 'good']); // interval 6, ease 2.5
    const easy = review(two, 'easy', two.due);
    expect(easy.interval).toBe(15); // 6 × 2.5, not 6 × 2.6
    expect(easy.ease).toBe(2.6);
  });

  it('good keeps ease, easy raises it, hard lowers it (SM-2)', () => {
    const c = newCard(T0);
    expect(review(c, 'good', T0).ease).toBe(2.5);
    expect(review(c, 'easy', T0).ease).toBe(2.6);
    expect(review(c, 'hard', T0).ease).toBe(2.36);
    expect(review(c, 'wrong', T0).ease).toBe(1.96);
  });

  it('wrong: back in 10 minutes, reps reset', () => {
    const learned = run(['good', 'good', 'good']);
    const now = learned.due + 5;
    const r = review(learned, 'wrong', now);
    expect(r).toMatchObject({ due: now + AGAIN_DELAY, interval: 0, reps: 0 });
  });

  it('counts a lapse only when a learned card is forgotten', () => {
    expect(review(newCard(T0), 'wrong', T0).lapses).toBe(0);
    expect(run(['good', 'wrong']).lapses).toBe(1);
    expect(run(['good', 'wrong', 'wrong']).lapses).toBe(1);
    expect(run(['good', 'wrong', 'good', 'wrong']).lapses).toBe(2);
  });

  it('after a lapse the card relearns from 1 day', () => {
    expect(run(['good', 'good', 'good', 'wrong', 'good']).interval).toBe(1);
  });

  it('ease never leaves 1.3–5', () => {
    expect(run(Array<Grade>(30).fill('wrong')).ease).toBe(MIN_EASE);
    expect(run(Array<Grade>(60).fill('easy')).ease).toBe(MAX_EASE);
  });

  it('interval never passes the cap', () => {
    const c = run(Array<Grade>(40).fill('easy'));
    expect(c.interval).toBe(MAX_INTERVAL);
  });

  it('due is always a whole number, even with a fractional now', () => {
    const r = review(newCard(T0), 'good', T0 + 0.7);
    expect(Number.isInteger(r.due)).toBe(true);
  });

  it('does not change the input card', () => {
    const c = newCard(T0);
    const copy = { ...c };
    review(c, 'easy', T0);
    expect(c).toEqual(copy);
  });

  it('every result is accepted by storage, over thousands of random reviews', () => {
    // Small fixed-seed generator, so the test is repeatable.
    let seed = 42;
    const rand = () => (seed = (seed * 1_103_515_245 + 12_345) % 2 ** 31) / 2 ** 31;
    const grades: Grade[] = ['wrong', 'hard', 'good', 'easy'];

    for (let c = 0; c < 50; c++) {
      let card = newCard(T0);
      let now = T0;
      for (let i = 0; i < 200; i++) {
        const g = grades[Math.floor(rand() * 4)]!;
        const next = review(card, g, now);
        const parsed = SrsStateSchema.safeParse(next);
        expect(parsed.success, JSON.stringify({ card, g, next })).toBe(true);
        expect(next.due).toBeGreaterThan(now);
        card = next;
        now = card.due + Math.floor(rand() * DAY);
      }
    }
  });
});

describe('isDue', () => {
  it('is due at or after the due time', () => {
    const c = { ...newCard(T0), due: T0 + 100 };
    expect(isDue(c, T0 + 99)).toBe(false);
    expect(isDue(c, T0 + 100)).toBe(true);
  });
});

describe('nextItems', () => {
  const cards: Record<string, SrsState> = {
    a: { ...newCard(T0), due: T0 - 1000 },
    b: { ...newCard(T0), due: T0 - 5000 },
    c: { ...newCard(T0), due: T0 + DAY },
  };
  const ids = ['a', 'b', 'c', 'x', 'y', 'z'];

  it('due cards first, most overdue first, then new ones', () => {
    expect(nextItems(ids, cards, T0, 2)).toEqual(['b', 'a', 'x', 'y']);
  });
  it('skips cards that are not due yet', () => {
    expect(nextItems(ids, cards, T0, 10)).not.toContain('c');
  });
  it('a new-card limit of 0 (or less) gives only due cards', () => {
    expect(nextItems(ids, cards, T0, 0)).toEqual(['b', 'a']);
    expect(nextItems(ids, cards, T0, -3)).toEqual(['b', 'a']);
  });
  it('ignores saved cards that are not in the list', () => {
    expect(nextItems(['x'], cards, T0, 5)).toEqual(['x']);
  });
});
