import { describe, expect, it } from 'vitest';
import { LEARNED_DAYS, cardStats, percents, statsText } from '../src/lib/stats';
import { DAY, newCard } from '../src/lib/srs';

const NOW = 1_700_000_000_000;
const card = (interval: number, due: number) => ({ ...newCard(NOW), interval, due });

describe('cardStats', () => {
  const srs = {
    a: card(LEARNED_DAYS, NOW + DAY), // learned
    b: card(LEARNED_DAYS - 1, NOW - 1), // learning, due
    c: card(0, NOW + 60_000), // learning, wrong recently
    z: card(30, NOW - 1), // not in the list
  };

  it('counts new, learning, learned and due', () => {
    expect(cardStats(['a', 'b', 'c', 'd'], srs, NOW)).toEqual({
      total: 4,
      fresh: 1,
      learning: 2,
      learned: 1,
      due: 1,
    });
  });

  it('ignores saved cards outside the list', () => {
    expect(cardStats(['d'], srs, NOW)).toEqual({ total: 1, fresh: 1, learning: 0, learned: 0, due: 0 });
  });

  it('empty list', () => {
    expect(cardStats([], srs, NOW).total).toBe(0);
  });
});

describe('percents', () => {
  it('splits the bar', () => {
    expect(percents({ total: 4, fresh: 1, learning: 2, learned: 1, due: 0 })).toEqual({
      learned: 25,
      learning: 50,
    });
  });
  it('never goes over 100 with thirds', () => {
    const p = percents({ total: 3, fresh: 0, learning: 2, learned: 1, due: 0 });
    expect(p.learned + p.learning).toBeLessThanOrEqual(100);
  });
  it('is 0 for no cards', () => {
    expect(percents({ total: 0, fresh: 0, learning: 0, learned: 0, due: 0 })).toEqual({
      learned: 0,
      learning: 0,
    });
  });
});

describe('statsText', () => {
  it('says all three counts', () => {
    expect(statsText({ total: 6, fresh: 3, learning: 2, learned: 1, due: 0 })).toBe(
      '1 learned · 2 learning · 3 new',
    );
  });
});
