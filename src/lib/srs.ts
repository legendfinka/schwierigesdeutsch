// SM-2 spaced repetition. Pure: pass `now` in, get a new state out.
import type { SrsState } from './storage';

export type Grade = 'wrong' | 'hard' | 'good' | 'easy';

export const DAY = 86_400_000;
// A wrong card comes back in the same session instead of tomorrow.
export const AGAIN_DELAY = 10 * 60_000;
export const START_EASE = 2.5;
// Same limits as storage, or storage drops the card.
export const MIN_EASE = 1.3;
export const MAX_EASE = 5;
export const MAX_INTERVAL = 36_500;

// SM-2 quality, 0–5.
const QUALITY: Record<Grade, number> = { wrong: 1, hard: 3, good: 4, easy: 5 };

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

export function newCard(now: number): SrsState {
  return { due: Math.round(now), interval: 0, ease: START_EASE, reps: 0, lapses: 0 };
}

export function review(card: SrsState, grade: Grade, now: number): SrsState {
  const q = QUALITY[grade];
  const at = Math.round(now);
  const ease = round2(clamp(card.ease + 0.1 - (5 - q) * (0.08 + (5 - q) * 0.02), MIN_EASE, MAX_EASE));
  // Broken saved ease must not poison the interval.
  const oldEase = clamp(card.ease, MIN_EASE, MAX_EASE);

  if (q < 3) {
    return {
      due: at + AGAIN_DELAY,
      interval: 0,
      ease,
      reps: 0,
      lapses: card.reps > 0 ? card.lapses + 1 : card.lapses,
    };
  }

  const reps = card.reps + 1;
  // Old ease for the interval, as in the SM-2 reference.
  const raw = reps === 1 ? 1 : reps === 2 ? 6 : Math.round(card.interval * oldEase);
  const interval = clamp(Math.max(raw, 1), 1, MAX_INTERVAL);
  return { due: at + interval * DAY, interval, ease, reps, lapses: card.lapses };
}

// Avoids float drift like 2.3600000000000003 piling up over many reviews.
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function isDue(card: SrsState, now: number): boolean {
  return card.due <= now;
}

/** Due cards first (most overdue first), then up to `newLimit` unseen ones in the given order. */
export function nextItems(
  ids: readonly string[],
  cards: Readonly<Record<string, SrsState>>,
  now: number,
  newLimit: number,
): string[] {
  const due = ids
    .filter((id) => cards[id] !== undefined && isDue(cards[id], now))
    .sort((a, b) => cards[a]!.due - cards[b]!.due);
  const fresh = ids.filter((id) => cards[id] === undefined).slice(0, Math.max(0, newLimit));
  return [...due, ...fresh];
}
