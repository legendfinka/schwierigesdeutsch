# CLAUDE.md — SchwierigeDeutsch

A free website for learning German: grammar explanations, quizzes, verb and noun
trainers, graded texts and audio. The goal is to make German *structure* understandable,
not only to drill vocabulary. Many learners can read every word in a sentence and still
not know what the subject, the object or the verb is. This site exists to fix that.

## Principles

1. **Correctness first.** A wrong article or ending on a learning site does real damage.
   Never guess German grammar. If unsure, flag it in a `// TODO(verify)` comment, or leave
   out the `verified` record (unverified content is hidden in production builds).
2. **Explain, don't just mark wrong.** Every exercise has an explanation that says *why*
   the answer is right (case, trigger, rule), in plain language.
3. **Original content only.** Do not copy texts, exercises or audio from Easy German,
   Deutsche Welle, textbooks or other sites. Inspiration is fine; reproduction is not.
4. **Free and lightweight.** No accounts, no ads, no paywall, no tracking. Must work on a
   cheap phone and a slow connection.
5. **Small, finished modules over many half-built ones.**

## Version 1 scope

- Noun trainer: article + noun + plural, spaced repetition, color-coded genders
- Case quizzes (nominative, accusative, dative, genitive) with explanations, including
  prepositions and two-way prepositions (wo? vs. wohin?)
- Sentence breakdown: tap a sentence to highlight verb bracket, subject, objects, extras
- Sentence builder: drag scrambled words into correct order (V2, verb-final, Satzklammer)
- A few graded stories (A1–A2) with audio, transcript and comprehension questions

Later (not v1): verb/tense trainer, dictation, shadowing, pronunciation check, placement
test, mistake log, themed units, Goethe/telc-style exam practice, more levels (B1–B2).

## Tech stack (default; change only if the owner decides)

- **Astro + TypeScript**, static output (no server, no database)
- Interactive parts as small islands (plain TS or Svelte), not a full SPA
- Content as JSON / Markdown in `src/content/`, validated with Astro content collections + Zod
- **Audio:** browser Web Speech API (`de-DE` voice) for v1; pre-generated audio files later
- **Progress:** `localStorage`, always wrapped in try/catch, with a safe empty default
- **Spaced repetition:** a simple SM-2 or FSRS implementation in `src/lib/srs.ts`
- **Hosting:** GitHub Pages or Cloudflare Pages
- Tests: Vitest for logic (SRS, answer checking, content validation)

## Structure

```
src/
  content.config.ts   # collections (nouns, quizzes, sentences) wired to the schemas
  content/
    nouns/            # noun entries (JSON)
    quizzes/          # quiz sets per topic (JSON)
    sentences/        # annotated sentences for breakdown/builder (JSON)
    texts/            # graded stories (Markdown + frontmatter)
    grammar/          # rule explanation pages (Markdown)
  components/         # UI components (QuizCard, GenderTag, SentenceView, ...)
  layouts/            # BaseLayout.astro (planned)
  lib/                # schemas.ts, json-array-loader.ts; planned: srs.ts, storage.ts,
                      # speech.ts, grading.ts
  pages/              # routes
  styles/             # global.css with design tokens
tests/                # schemas.test.ts, content.test.ts, ...
```

- Zod schemas live in `src/lib/schemas.ts` (not in `content.config.ts`) so Vitest can
  import them without Astro.
- JSON collections use the `jsonDir` loader (`src/lib/json-array-loader.ts`): any number of
  `.json` files per folder, each holding one entry or an array of entries, every entry with
  a unique string `id`. Group content in small topic files, e.g. `nouns/a1-food.json`,
  `quizzes/a2-dative-prepositions.json`.

## Commands

```
npm install
npm run dev        # local dev server
npm run build      # static build
npm run check      # astro check (types)
npm run test       # unit tests + content validation
```

Run `npm run test` and `npm run check` before considering any content or logic change
finished.

## Content schemas

Noun — always store article, plural and an example sentence:

```json
{
  "id": "tisch",
  "noun": "Tisch",
  "gender": "m",
  "plural": "Tische",
  "level": "A1",
  "translation": { "en": "table" },
  "example": "Der Tisch steht in der Küche.",
  "genderRule": null,
  "verified": {
    "sources": ["duden", "dwds", "verbformen"],
    "date": "2026-11-24",
    "notes": "Article and plural checked."
  }
}
```

`verified` (all collections) records who confirmed an entry. Leave it out while an entry
is unverified: it is then shown only in dev, with an "unreviewed" badge, and never in a
production build. Rules: at least 2 sources, or `"native-speaker"`. Allowed source ids:
`duden`, `duden-mentor`, `dwds`, `leo`, `verbformen`, `collins`, `wiktionary`,
`yourdailygerman`, `dartmouth`, `native-speaker`. `date` is `YYYY-MM-DD`. Use `notes` for
what was and wasn't checked and for source disagreements. Schemas are strict: unknown
fields (e.g. the old `needsReview`) fail validation.

Use `"plural": null` only for nouns with no plural, and `"pluralOnly": true` for nouns
like *die Leute*. `genderRule` links to a rule id when one applies (e.g. `"suffix-ung"`).

Quiz question:

```json
{
  "id": "cases-dat-001",
  "topic": "cases/dative",
  "kind": "gap",
  "level": "A2",
  "prompt": "Ich gebe ___ Frau das Buch.",
  "options": ["die", "der", "den", "dem"],
  "answer": "der",
  "explanation": { "en": "The receiver of 'geben' is dative. Feminine dative: die → der." },
  "hint": { "en": "With 'geben', the person receiving is in which case?" },
  "verified": { "sources": ["duden-mentor", "dartmouth"], "date": "2026-11-24" }
}
```

`kind` is `"gap"` (prompt contains `___`, the default) or `"question"` (a plain question
such as "Which case follows 'mit'?", no `___`). `explanation` and `hint` are always
localized objects.

Exactly one option may be correct. If a second option could be correct in any reading,
rewrite the question.

Annotated sentence (for breakdown and builder):

```json
{
  "id": "s-0001",
  "level": "A2",
  "text": "Gestern hat der Lehrer dem Schüler das Buch gegeben.",
  "translation": { "en": "Yesterday the teacher gave the student the book." },
  "parts": [
    { "t": "Gestern", "role": "extra" },
    { "t": "hat", "role": "verb1" },
    { "t": "der Lehrer", "role": "subject", "case": "nom" },
    { "t": "dem Schüler", "role": "object", "case": "dat" },
    { "t": "das Buch", "role": "object", "case": "acc" },
    { "t": "gegeben", "role": "verb2" }
  ]
}
```

Roles: `verb1` (conjugated verb), `verb2` (infinitive/participle/separable prefix),
`subject`, `object`, `extra` (adverbs, prepositional phrases), `connector`
(dass, weil, und…), `clause` for nested sub-clauses.

## Conventions

- **Gender colors:** der = blue, die = red, das = green, plural = gray/purple (muted autumn
  tones, see *Design*). Use the same
  tokens everywhere (`--gender-m`, `--gender-f`, `--gender-n`, `--gender-pl`). Never rely on
  color alone: always show the article text too (accessibility, color blindness).
- **German text:** always real umlauts and ß (ä ö ü Ä Ö Ü ß), never ae/oe/ue/ss substitutes.
  UTF-8 everywhere. Capitalize all nouns.
- **Levels:** tag all content with a CEFR level (A1, A2, B1, B2).
- **Explanations** in simple English, short, naming the rule (e.g. "mit always takes dative").
  Structure them so more explanation languages can be added later (`{ "en": "..." }`).
- **Answer checking:** normalize whitespace and case where appropriate, but never treat a
  missing umlaut as correct. Optionally accept `a:`/`ae` input but show the correct form.
- **Audio:** feature-detect speech synthesis; if no German voice is available, hide the
  play button rather than reading German with an English voice.
- **Mobile first.** Tap targets ≥ 44px. Works without JavaScript for reading pages.
- Code: TypeScript strict mode, small pure functions in `src/lib`, no unnecessary dependencies.

## Design

The site should feel **warm, autumn-like and cozy**: simple and easy on the eyes, but
pleasant, like reading by a window in October. Calm, not flashy.

- **Palette:** warm cream / paper background (not pure white), dark warm brown text (not
  pure black), accents in amber, rust, pumpkin and deep olive. Dark mode: warm
  charcoal-brown background with cream text, same accents slightly muted.
  Follow `prefers-color-scheme`.
- **Gender colors** keep their meaning (der = blue, die = red, das = green, plural =
  gray/purple) but in muted autumn tones that fit the palette: slate/dusk blue, brick red,
  moss green, plum/heather. Keep enough contrast (WCAG AA) on both themes, and always show
  the article text too.
- **Type:** system font stack, generous line height, comfortable reading width (~40rem).
  Large, clear German text in exercises.
- **Shapes:** soft rounded corners, gentle shadows or thin warm borders, plenty of
  whitespace. No hard neon colors, no busy backgrounds, no heavy animation (respect
  `prefers-reduced-motion`).
- **Layout:** one shared `BaseLayout.astro` with a simple top nav. Pages: home, `/nouns`
  (trainer), `/cases` (quizzes), `/sentences` (breakdown + builder), `/stories`,
  `/grammar`.
- **Trainers:** one card at a time, big answer buttons (≥ 44px; e.g. der / die / das),
  then a short explanation of why. Friendly feedback, never harsh red screens.
- **Reading pages** (grammar, stories) are plain HTML and work without JavaScript; only
  trainers need JS.
- All colors, radii and spacing come from CSS custom properties in `src/styles/global.css`.

## Progress storage

Everything stays in the browser. No accounts, no server.

- One versioned `localStorage` key, `sd:v1`, holding SRS state per item (due date,
  interval, ease), quiz results and settings.
- Read and write only through `src/lib/storage.ts`. Always try/catch. Validate loaded data
  with Zod; if it is broken or from an unknown version, fall back to empty progress (never
  crash). Add migrations when the version changes.
- If storage is unavailable (private mode, blocked), the trainers still work and show a
  small "progress won't be saved" note.
- **Export / Import** buttons that save and load progress as a JSON file: the only way to
  back up or move progress to another device.

## When adding content

1. **Write in small topic files**, one per topic and level. Claude drafts a batch; the
   owner reviews the diff.
2. **Verify against these sources:** duden.de, dwds.de, dict.leo.org, verbformen.com,
   mentor.duden.de, collinsdictionary.com, de.wiktionary.org, yourdailygerman.com,
   dartmouth.edu/~deutsch/Grammatik/Grammatik.html. Check several. **If most (not
   necessarily all) agree, treat it as true**, and note the dissenting source.
3. Dictionaries confirm article and plural only. **Translations and example sentences need
   their own check** (native speaker or a source that shows the usage).
4. Check that each quiz has exactly one correct answer.
5. Write an explanation that names the case and what triggers it.
6. Add a `verified` record only once it is verified this way; otherwise leave it out.
7. Run `npm run test` and `npm run check`.

## Roadmap

Do these in order; each step ends with tests passing and something that works.

0. ~~Scaffold: Astro + TS, schemas, content validation tests, 10 verified A1 nouns.~~ Done.
1. ~~Content verification record: `verified` replaces `needsReview`; unverified content
   hidden in production, badge in dev.~~ Done.
2. **Extra content checks** in `tests/content.test.ts`: example sentence article matches the
   noun's gender when the noun is the subject; quiz options are all the same type;
   `genderRule` points to an existing rule id (once rules exist).
3. **Design system + layout.** Autumn palette and tokens in `global.css` (light + dark),
   `BaseLayout.astro`, top nav, home page, `GenderTag` component. Replace the placeholder
   page.
4. **Storage.** `src/lib/storage.ts` as described in *Progress storage*, with tests
   (broken data, wrong version, storage unavailable).
5. **Spaced repetition.** `src/lib/srs.ts` (SM-2 first), pure functions, with tests.
6. **Noun trainer** (`/nouns`): article quiz → plural check, SRS scheduling, explanation
   per card. Add ~40 more verified A1 nouns first, in topic files.
7. **Answer checking.** `src/lib/grading.ts` (whitespace/case normalization, umlaut rules
   from *Conventions*), with tests.
8. **Case quizzes** (`/cases`): quiz UI + verified question sets for nom/acc/dat/gen,
   prepositions, two-way prepositions.
9. **Grammar pages** (`/grammar`): short Markdown rule pages linked from explanations and
   `genderRule`.
10. **Sentence breakdown** (`/sentences`): annotated sentences, tap to highlight roles.
11. **Sentence builder:** drag/tap words into order (V2, verb-final, Satzklammer), with a
    keyboard/tap alternative to dragging.
12. **Graded stories** (`/stories`): A1–A2 texts, Web Speech audio (hidden without a German
    voice), comprehension questions.
13. **Export / Import progress**, settings page.
14. **Hosting:** GitHub Pages or Cloudflare Pages, build in CI with tests.

## Don't

- Don't add accounts, analytics, ads or third-party trackers without the owner's approval.
- Don't copy copyrighted texts, exercises or recordings.
- Don't invent grammar rules or "exceptions" to make an exercise work.
- Don't add heavy frameworks or a backend for v1.
