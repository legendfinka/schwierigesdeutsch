// Logic of the case quizzes. Pure, so it can be tested without a browser.
import { CASE_TOPIC_IDS, quizTopic, type CaseTopicId } from './case-topics';
import type { QuizQuestion } from './schemas';
import type { QuizResult } from './storage';

export const QUESTIONS_PER_ROUND = 10;

export interface QuizCard {
  id: string;
  topic: string;
  prompt: string;
  options: string[];
  answer: string;
  explanation: string;
  hint: string | null;
  reviewed: boolean; // false only shows in dev
}

export function toQuizCard(q: QuizQuestion): QuizCard {
  return {
    id: q.id,
    topic: q.topic,
    prompt: q.prompt,
    options: q.options,
    answer: q.answer,
    explanation: q.explanation.en,
    hint: q.hint?.en ?? null,
    reviewed: q.verified !== undefined,
  };
}

export type Random = () => number;

// Fisher–Yates, so the right answer has no favourite position.
export function shuffle<T>(items: readonly T[], random: Random = Math.random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

// The full sentence, with the answer in the gap.
export function filledPrompt(card: Pick<QuizCard, 'prompt' | 'answer'>): string {
  const filled = card.prompt.replace('___', card.answer);
  return filled.charAt(0).toUpperCase() + filled.slice(1);
}

// Never tried first, then the ones missed most, then the longest not seen.
export function pickQuestions(
  ids: readonly string[],
  results: Readonly<Record<string, QuizResult>>,
  limit: number = QUESTIONS_PER_ROUND,
  random: Random = Math.random,
): string[] {
  const missRate = (r: QuizResult) => r.wrong / Math.max(1, r.correct + r.wrong);
  const fresh = shuffle(ids.filter((id) => !results[id]), random);
  const seen = ids
    .filter((id) => results[id])
    .sort(
      (a, b) =>
        missRate(results[b]!) - missRate(results[a]!) || results[a]!.last - results[b]!.last,
    );
  return [...fresh, ...seen].slice(0, Math.max(0, limit));
}

export function recordResult(
  previous: QuizResult | undefined,
  correct: boolean,
  now: number,
): QuizResult {
  return {
    correct: (previous?.correct ?? 0) + (correct ? 1 : 0),
    wrong: (previous?.wrong ?? 0) + (correct ? 0 : 1),
    last: Math.round(now),
  };
}

export interface QuizStats {
  total: number;
  tried: number;
  rightPercent: number | null; // null = nothing answered yet
}

export function quizStats(
  ids: readonly string[],
  results: Readonly<Record<string, QuizResult>>,
): QuizStats {
  let tried = 0;
  let correct = 0;
  let answers = 0;
  for (const id of ids) {
    const r = results[id];
    if (!r) continue;
    tried++;
    correct += r.correct;
    answers += r.correct + r.wrong;
  }
  return {
    total: ids.length,
    tried,
    rightPercent: answers === 0 ? null : Math.round((correct / answers) * 100),
  };
}

export function quizStatsText(s: QuizStats): string {
  const tried = `${s.tried} of ${s.total} tried`;
  return s.rightPercent === null ? tried : `${tried} · ${s.rightPercent}% right`;
}

export function caseTopicFromQuery(search: string): CaseTopicId | null {
  const v = new URLSearchParams(search).get('topic') ?? '';
  return (CASE_TOPIC_IDS as readonly string[]).includes(v) ? (v as CaseTopicId) : null;
}

// An empty or unknown topic means all questions.
export function questionsFor(all: readonly QuizCard[], topic: CaseTopicId | null) {
  const inTopic = topic ? all.filter((c) => c.topic === quizTopic(topic)) : [];
  return inTopic.length > 0 ? { cards: inTopic, topic } : { cards: [...all], topic: null };
}
