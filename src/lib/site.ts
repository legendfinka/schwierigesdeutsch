// Where mistake reports go. Change here if the repo moves.
export const REPO_URL = 'https://github.com/legendfinka/schwierigesdeutsch';

// Prefilled issue. Contains only the word, never anything about the learner.
export function reportUrl(noun: string, id: string, repo: string = REPO_URL): string {
  const q = new URLSearchParams({
    title: `Mistake in noun: ${noun}`,
    body: `Noun id: ${id}\n\nWhat is wrong?\n`,
  });
  return `${repo}/issues/new?${q.toString()}`;
}
