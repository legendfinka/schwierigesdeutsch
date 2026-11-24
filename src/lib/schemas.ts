import { z } from 'zod';

export const LEVELS = ['A1', 'A2', 'B1', 'B2'] as const;
export const GENDERS = ['m', 'f', 'n'] as const;
export const CASES = ['nom', 'acc', 'dat', 'gen'] as const;
export const ROLES = [
  'verb1',
  'verb2',
  'subject',
  'object',
  'extra',
  'connector',
  'clause',
] as const;

export const Level = z.enum(LEVELS);
export const Gender = z.enum(GENDERS);
export const Case = z.enum(CASES);
export const Role = z.enum(ROLES);

/** Text in one or more languages. Only English for now; add keys later. */
export const LocalizedText = z.object({ en: z.string().min(1) });

// ---------------------------------------------------------- Verification

/** Sources accepted for verifying content (see CLAUDE.md, "When adding content"). */
export const SOURCES = [
  'duden',
  'duden-mentor',
  'dwds',
  'leo',
  'verbformen',
  'collins',
  'wiktionary',
  'yourdailygerman',
  'dartmouth',
  'native-speaker',
] as const;

const isRealDate = (s: string) => {
  const d = new Date(`${s}T00:00:00Z`);
  return !Number.isNaN(d.getTime()) && d.toISOString().slice(0, 10) === s;
};

/**
 * Who confirmed an entry, and when. Absent = unverified (hidden in production).
 * Needs at least two sources (majority rule), or a native speaker.
 */
export const Verified = z
  .object({
    sources: z.array(z.enum(SOURCES)).min(1),
    date: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, 'date must be YYYY-MM-DD')
      .refine(isRealDate, 'date must be a real calendar date'),
    notes: z.string().min(1).optional(),
  })
  .strict()
  .superRefine((v, ctx) => {
    if (new Set(v.sources).size !== v.sources.length) {
      ctx.addIssue({ code: 'custom', path: ['sources'], message: 'sources must be unique' });
    }
    if (v.sources.length < 2 && !v.sources.includes('native-speaker')) {
      ctx.addIssue({
        code: 'custom',
        path: ['sources'],
        message: 'need at least 2 sources, or a native speaker',
      });
    }
  });

// ---------------------------------------------------------------- Noun

export const NounSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/, 'id must be lowercase ascii, digits, dashes'),
    noun: z.string().min(1),
    gender: Gender,
    plural: z.string().min(1).nullable(),
    pluralOnly: z.boolean().optional(),
    level: Level,
    translation: LocalizedText,
    example: z.string().min(1),
    genderRule: z.string().min(1).nullable(),
    verified: Verified.optional(),
  })
  .strict()
  .superRefine((n, ctx) => {
    if (n.pluralOnly && n.plural === null) {
      ctx.addIssue({
        code: 'custom',
        path: ['plural'],
        message: 'pluralOnly nouns must have a plural form',
      });
    }
    const forms = [n.noun, n.plural].filter((f): f is string => f !== null);
    if (!forms.some((f) => n.example.includes(f))) {
      ctx.addIssue({
        code: 'custom',
        path: ['example'],
        message: 'example sentence must contain the noun or its plural',
      });
    }
  });

// ---------------------------------------------------------------- Quiz

export const QuizQuestionSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    topic: z.string().min(1),
    /** "gap": fill the ___ in the prompt. "question": a plain question. */
    kind: z.enum(['gap', 'question']).default('gap'),
    level: Level,
    prompt: z.string().min(1),
    options: z.array(z.string().min(1)).min(2),
    answer: z.string().min(1),
    explanation: LocalizedText,
    hint: LocalizedText.optional(),
    verified: Verified.optional(),
  })
  .strict()
  .superRefine((q, ctx) => {
    if (new Set(q.options).size !== q.options.length) {
      ctx.addIssue({ code: 'custom', path: ['options'], message: 'options must be unique' });
    }
    const matches = q.options.filter((o) => o === q.answer).length;
    if (matches !== 1) {
      ctx.addIssue({
        code: 'custom',
        path: ['answer'],
        message: 'answer must match exactly one option',
      });
    }
    const hasGap = q.prompt.includes('___');
    if (q.kind === 'gap' && !hasGap) {
      ctx.addIssue({ code: 'custom', path: ['prompt'], message: 'gap prompt must contain ___' });
    }
    if (q.kind === 'question' && hasGap) {
      ctx.addIssue({ code: 'custom', path: ['kind'], message: 'prompt has ___, use kind "gap"' });
    }
  });

// ------------------------------------------------------------ Sentence

export const SentencePartSchema = z
  .object({
    t: z.string().min(1),
    role: Role,
    case: Case.optional(),
  })
  .strict();

const stripPunctuation = (s: string) =>
  s
    .replace(/[.,!?;:„“"]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

export const AnnotatedSentenceSchema = z
  .object({
    id: z.string().regex(/^[a-z0-9-]+$/),
    level: Level,
    text: z.string().min(1),
    translation: LocalizedText,
    parts: z.array(SentencePartSchema).min(1),
    verified: Verified.optional(),
  })
  .strict()
  .superRefine((s, ctx) => {
    s.parts.forEach((p, i) => {
      if ((p.role === 'subject' || p.role === 'object') && !p.case) {
        ctx.addIssue({
          code: 'custom',
          path: ['parts', i, 'case'],
          message: `${p.role} needs a case`,
        });
      }
    });
    const joined = stripPunctuation(s.parts.map((p) => p.t).join(' '));
    if (joined !== stripPunctuation(s.text)) {
      ctx.addIssue({
        code: 'custom',
        path: ['parts'],
        message: 'parts must reproduce the sentence text in order',
      });
    }
  });

export type VerifiedRecord = z.infer<typeof Verified>;
export type Noun = z.infer<typeof NounSchema>;
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;
export type AnnotatedSentence = z.infer<typeof AnnotatedSentenceSchema>;
