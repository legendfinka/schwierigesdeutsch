// Progress counts for a set of cards. Pure.
import type { SrsState } from './storage';
import { isDue } from './srs';

// Anki's "mature" line: an interval this long means it has stuck.
export const LEARNED_DAYS = 21;

export interface Stats {
  total: number;
  fresh: number; // never seen
  learning: number;
  learned: number;
  due: number; // seen before and due now
}

export function cardStats(
  ids: readonly string[],
  srs: Readonly<Record<string, SrsState>>,
  now: number,
): Stats {
  const s: Stats = { total: ids.length, fresh: 0, learning: 0, learned: 0, due: 0 };
  for (const id of ids) {
    const card = srs[id];
    if (!card) {
      s.fresh++;
      continue;
    }
    if (card.interval >= LEARNED_DAYS) s.learned++;
    else s.learning++;
    if (isDue(card, now)) s.due++;
  }
  return s;
}

// Whole percents that never add up to more than 100.
export function percents(s: Stats): { learned: number; learning: number } {
  if (s.total === 0) return { learned: 0, learning: 0 };
  const learned = Math.floor((s.learned / s.total) * 100);
  const learning = Math.floor(((s.learned + s.learning) / s.total) * 100) - learned;
  return { learned, learning };
}

export function statsText(s: Stats): string {
  return `${s.learned} learned · ${s.learning} learning · ${s.fresh} new`;
}
