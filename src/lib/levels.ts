import { LEVELS } from './schemas';

export type Level = (typeof LEVELS)[number];

// LEVELS order, empty levels left out.
export function groupByLevel<T extends { level: Level }>(
  items: readonly T[],
): Array<{ level: Level; items: T[] }> {
  return LEVELS.map((level) => ({ level, items: items.filter((i) => i.level === level) })).filter(
    (g) => g.items.length > 0,
  );
}

export const levelsOf = (items: readonly { level: Level }[]): Level[] =>
  groupByLevel(items).map((g) => g.level);
