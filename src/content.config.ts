import { defineCollection } from 'astro:content';
import { jsonDir } from './lib/json-array-loader';
import { NounSchema, QuizQuestionSchema, AnnotatedSentenceSchema } from './lib/schemas';

// All JSON collections use the same format: any number of files per folder,
// each holding one entry or an array of entries.
const nouns = defineCollection({ loader: jsonDir('src/content/nouns'), schema: NounSchema });
const quizzes = defineCollection({ loader: jsonDir('src/content/quizzes'), schema: QuizQuestionSchema });
const sentences = defineCollection({
  loader: jsonDir('src/content/sentences'),
  schema: AnnotatedSentenceSchema,
});

export const collections = { nouns, quizzes, sentences };
