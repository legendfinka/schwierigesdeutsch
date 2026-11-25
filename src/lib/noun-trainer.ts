// Logic of the noun trainer. Pure, so it can be tested without a browser.
import { checkPlural } from './grading';
import { ARTICLE } from './gender';
import { isDue, nextItems, type Grade } from './srs';
import type { Noun } from './schemas';
import type { SrsState } from './storage';
import { TOPIC_IDS, type TopicId } from './topics';
import { LEVELS } from './schemas';
import { levelsOf, type Level } from './levels';
import { newSession, type Session } from './session';

export const ARTICLES = ['der', 'die', 'das'] as const;
export type Article = (typeof ARTICLES)[number];

export const NEW_PER_SESSION = 10;

export interface TrainerCard {
  id: string;
  noun: string;
  gender: Noun['gender'];
  plural: string | null;
  pluralOnly: boolean;
  translation: string;
  example: string;
  genderRule: string | null;
  topic: TopicId;
  level: Level;
}

export function toTrainerCard(n: Noun): TrainerCard {
  return {
    id: n.id,
    topic: n.topic,
    level: n.level,
    noun: n.noun,
    gender: n.gender,
    plural: n.plural,
    pluralOnly: n.pluralOnly === true,
    translation: n.translation.en,
    example: n.example,
    genderRule: n.genderRule,
  };
}

// plural-only and singular-only nouns have nothing to type.
export const asksPlural = (c: Pick<TrainerCard, 'plural' | 'pluralOnly'>) =>
  c.plural !== null && !c.pluralOnly;

export interface Result {
  articleOk: boolean;
  pluralOk: boolean | null; // null = not asked
  pluralExact: boolean; // false = accepted, but show the real spelling
  correct: boolean;
}

export function gradeCard(card: TrainerCard, article: Article, typedPlural: string): Result {
  const articleOk = article === ARTICLE[card.gender];
  if (!asksPlural(card) || card.plural === null) {
    return { articleOk, pluralOk: null, pluralExact: true, correct: articleOk };
  }
  const verdict = checkPlural(typedPlural, card.plural);
  const pluralOk = verdict !== 'wrong';
  return { articleOk, pluralOk, pluralExact: verdict === 'exact', correct: articleOk && pluralOk };
}

// A wrong card is always "wrong". A right one takes the learner's own rating.
export type Rating = 'hard' | 'good' | 'easy';

export function finalGrade(result: Result, rating: Rating): Grade {
  return result.correct ? rating : 'wrong';
}

export { advance, currentEntry, sessionProgress, type Entry, type Session } from './session';

export function startSession(
  ids: readonly string[],
  srs: Readonly<Record<string, SrsState>>,
  now: number,
  newLimit: number = NEW_PER_SESSION,
): Session {
  return newSession(nextItems(ids, srs, now, newLimit));
}

// Only known values pass, anything else means "all".
function fromQuery<T extends string>(search: string, key: string, allowed: readonly T[]): T | null {
  const v = new URLSearchParams(search).get(key);
  return (allowed as readonly string[]).includes(v ?? '') ? (v as T) : null;
}

export const topicFromQuery = (search: string) => fromQuery(search, 'topic', TOPIC_IDS);
export const levelFromQuery = (search: string) => fromQuery(search, 'level', LEVELS);

export interface Picked {
  cards: TrainerCard[];
  topic: TopicId | null; // what is really shown
  level: Level | null;
  levels: Level[]; // levels the shown topic has
}

// An empty filter falls back to a wider one, so the trainer is never empty for no reason.
export function pickCards(all: readonly TrainerCard[], topic: TopicId | null, level: Level | null): Picked {
  const inTopic = topic ? all.filter((c) => c.topic === topic) : [];
  const base = inTopic.length > 0 ? inTopic : [...all];
  const shownTopic = inTopic.length > 0 ? topic : null;
  const inLevel = level ? base.filter((c) => c.level === level) : [];
  return inLevel.length > 0
    ? { cards: inLevel, topic: shownTopic, level, levels: levelsOf(base) }
    : { cards: base, topic: shownTopic, level: null, levels: levelsOf(base) };
}

// Time until the next reviewed card is due, or null if none is waiting.
export function nextDueIn(
  ids: readonly string[],
  srs: Readonly<Record<string, SrsState>>,
  now: number,
): number | null {
  const waiting = ids.flatMap((id) => {
    const card = srs[id];
    return card && !isDue(card, now) ? [card.due - now] : [];
  });
  return waiting.length === 0 ? null : Math.min(...waiting);
}

export function formatWait(ms: number): string {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'}`;
  const hours = Math.ceil(minutes / 60);
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'}`;
  const days = Math.ceil(hours / 24);
  return `${days} day${days === 1 ? '' : 's'}`;
}
