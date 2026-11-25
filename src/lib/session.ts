// One practice round, shared by the noun trainer and the quizzes. Pure.

// A card answered wrong comes back once more at the end, and that retry isn't saved.
export interface Entry {
  id: string;
  retry: boolean;
}

export interface Session {
  queue: readonly Entry[];
  total: number;
  firstTry: number; // right on the first try
}

export function newSession(ids: readonly string[]): Session {
  return { queue: ids.map((id) => ({ id, retry: false })), total: ids.length, firstTry: 0 };
}

export const currentEntry = (s: Session): Entry | undefined => s.queue[0];

export function advance(s: Session, wasCorrect: boolean): Session {
  const [head, ...rest] = s.queue;
  if (!head) return s;
  const again = !wasCorrect && !head.retry ? [{ id: head.id, retry: true }] : [];
  return {
    queue: [...rest, ...again],
    total: s.total,
    firstTry: s.firstTry + (wasCorrect && !head.retry ? 1 : 0),
  };
}

// Retries don't count, so the bar never goes backwards.
export function sessionProgress(s: Session): { done: number; total: number } {
  const left = s.queue.filter((e) => !e.retry).length;
  return { done: s.total - left, total: s.total };
}
