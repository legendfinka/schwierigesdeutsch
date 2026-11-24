import { describe, expect, it } from 'vitest';
import { groupByLevel, levelsOf } from '../src/lib/levels';

const items = [
  { id: 'b', level: 'B1' as const },
  { id: 'a', level: 'A1' as const },
  { id: 'c', level: 'A1' as const },
];

describe('groupByLevel', () => {
  it('keeps A1 → B2 order and the item order inside', () => {
    expect(groupByLevel(items)).toEqual([
      { level: 'A1', items: [items[1], items[2]] },
      { level: 'B1', items: [items[0]] },
    ]);
  });
  it('leaves out empty levels', () => {
    expect(levelsOf(items)).toEqual(['A1', 'B1']);
    expect(levelsOf([])).toEqual([]);
  });
});
