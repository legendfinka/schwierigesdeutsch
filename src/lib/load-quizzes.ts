// Quiz questions that may show on this build. Pages only: needs astro:content.
import { getCollection } from 'astro:content';
import type { QuizQuestion } from './schemas';
import { REQUIRED_CHECKS, isVisible } from './visibility';

export async function visibleQuizzes(): Promise<QuizQuestion[]> {
  const entries = await getCollection('quizzes', ({ data }) =>
    isVisible(data, import.meta.env.DEV, REQUIRED_CHECKS.quiz),
  );
  return entries.map((e) => e.data);
}
