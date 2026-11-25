// Where mistake reports go. Change here if the repo moves.
export const REPO_URL = 'https://github.com/legendfinka/schwierigesdeutsch';

// Prefilled issue. Contains only the content, never anything about the learner.
export function reportUrl(
  what: string,
  id: string,
  repo: string = REPO_URL,
  kind: 'noun' | 'quiz' = 'noun',
): string {
  const label = kind === 'noun' ? 'Noun' : 'Quiz';
  const q = new URLSearchParams({
    title: `Mistake in ${kind}: ${what}`,
    body: `${label} id: ${id}\n\nWhat is wrong?\n`,
  });
  return `${repo}/issues/new?${q.toString()}`;
}
