import { defineCollection } from 'astro:content';
import { jsonDir } from './lib/json-array-loader';
import { NounSchema, QuizQuestionSchema, AnnotatedSentenceSchema } from './lib/schemas';

const nouns = defineCollection({ loader: jsonDir('src/content/nouns'), schema: NounSchema });
const quizzes = defineCollection({ loader: jsonDir('src/content/quizzes'), schema: QuizQuestionSchema });
const sentences = defineCollection({
  loader: jsonDir('src/content/sentences'),
  schema: AnnotatedSentenceSchema,
});

export const collections = { nouns, quizzes, sentences };
