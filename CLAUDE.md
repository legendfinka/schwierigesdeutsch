# CLAUDE.md — Schwieriges Deutsch

Free site for learning German *structure*: articles, cases, word order. Many learners can
read every word and still not see the subject, object or verb. This site fixes that.

Name: **Schwieriges Deutsch** (two words, strong ending -es). Package id: `schwieriges-deutsch`.

## Principles

1. **Correctness first.** Never guess German grammar. Unsure? Leave out `verified`
   (unverified content never ships) or add `// TODO(verify)`.
2. **Explain, don't just mark wrong.** Every answer says *why* (case, trigger, rule).
3. **Original content only.** No copying from Easy German, DW, textbooks or other sites.
4. **Free and light.** No accounts, ads, paywall or tracking. Works on a cheap phone.
5. **Small finished modules** over many half-built ones.

## Scope

v1: noun trainer (article + plural, spaced repetition) · case quizzes incl. prepositions
and wo?/wohin? · sentence breakdown (tap to see verb bracket, subject, objects) · sentence
builder (V2, verb-final, Satzklammer) · a few A1–A2 stories with audio and questions.

Later: verbs/tenses, dictation, pronunciation, placement test, mistake log, exam practice, B1–B2.

## Stack

Astro + TypeScript (strict), static output, no backend. Interactive parts as small islands
(plain TS or Svelte). Content in `src/content/`, validated by Zod. Audio via Web Speech API
(`de-DE`). Progress in `localStorage`. Tests with Vitest. Hosting: GitHub or Cloudflare Pages.
No heavy frameworks, no unneeded dependencies.

```
npm run dev | build | check | test
```

Run `test` and `check` before calling any change done.

## Layout

```
src/content/       nouns/ quizzes/ sentences/ (JSON) · texts/ grammar/ (Markdown)
src/lib/           schemas, content checks, loaders, storage, topics, gender, url
src/components/    GenderTag, Logo, …
src/layouts/       BaseLayout.astro
src/styles/        global.css (all design tokens)
tests/
```

- Schemas live in `src/lib/schemas.ts` so tests can use them without Astro.
- A content folder can have many `.json` files; each holds one entry or a list. Use small
  topic files, in a folder per level: `nouns/a1/food.json`, `nouns/a2/…`. The folder must match
  each noun's `level` (tested). Every entry needs a unique `id`.
- Internal links go through `url()` so a sub-folder `base` works.

## Content

The schemas enforce the details. What you need to decide:

**Noun**

```json
{ "id": "tisch", "noun": "Tisch", "gender": "m", "plural": "Tische", "level": "A1",
  "topic": "home", "translation": { "en": "table" },
  "example": "Der Tisch steht in der Küche.", "genderRule": null,
  "verified": { "sources": ["duden", "dwds"], "checked": ["gender", "plural"], "date": "2026-11-24" } }
```

- `gender`: `m` `f` `n`, or `pl` for plural-only nouns.
- No plural (*Wasser*): `"singularOnly": true, "plural": null`. Plural only (*Leute*):
  `"pluralOnly": true, "gender": "pl"`, plural = noun. Mixed senses: use the everyday A1 sense.
- `topic`: an id from `src/lib/topics.ts`. Add new topics there.
- `genderRule`: `null`, or a rule id with a page at `src/content/grammar/<id>.md`.

**Quiz** — `kind` is `gap` (prompt has `___`) or `question`. Exactly one option may be
correct in any reading, otherwise rewrite it.

```json
{ "id": "cases-dat-001", "topic": "cases/dative", "kind": "gap", "level": "A2",
  "prompt": "Ich gebe ___ Frau das Buch.", "options": ["die", "der", "den", "dem"],
  "answer": "der", "explanation": { "en": "The receiver of 'geben' is dative: die → der." },
  "hint": { "en": "Who receives? Which case?" } }
```

**Sentence** — roles: `verb1` (conjugated), `verb2` (infinitive, participle, prefix),
`subject`, `object`, `extra`, `connector`, `clause`. Subjects and objects need a `case`.

```json
{ "id": "s-0001", "level": "A2", "text": "Gestern hat der Lehrer dem Schüler das Buch gegeben.",
  "translation": { "en": "Yesterday the teacher gave the student the book." },
  "parts": [{ "t": "Gestern", "role": "extra" }, { "t": "hat", "role": "verb1" },
    { "t": "der Lehrer", "role": "subject", "case": "nom" },
    { "t": "dem Schüler", "role": "object", "case": "dat" },
    { "t": "das Buch", "role": "object", "case": "acc" }, { "t": "gegeben", "role": "verb2" }] }
```

### Verification

- `verified` = who confirmed it (`sources`: 2+, or `native-speaker`) and what (`checked`).
  List only parts the sources really confirmed, never guesses or page summaries.
- No `verified` → dev only, with an "unreviewed" badge.
- Production also needs: nouns `gender` + `plural`, quizzes `answer` + `explanation`,
  sentences `roles` + `translation`.
- Unchecked parts may show, but each page says so once (e.g. "English meanings are not checked
  word by word yet"), with no per-word marker. Translations and examples are checked later, one
  word at a time. Use `isChecked()` to know what is confirmed.
- `notes`: source disagreements and caveats.

### Adding content

1. Draft a small topic file. The owner reviews the diff.
2. Check several sources: duden.de, dwds.de, dict.leo.org, verbformen.com, mentor.duden.de,
   collinsdictionary.com, de.wiktionary.org, yourdailygerman.com, Dartmouth Grammatik.
   **Most agree = true.** Note who disagrees.
3. Dictionaries confirm article and plural only. Translations and examples need their own check.
4. Explanations name the case and its trigger.
5. Add `verified` only after checking. Run `test` and `check`.

## Conventions

- Real umlauts and ß, never ae/oe/ue/ss. Capitalize nouns. Tag a CEFR level on everything.
- Explanations: short simple English, name the rule ("mit always takes dative"), as `{ "en": … }`.
- Answer checking: normalize spaces and case, but a missing umlaut is never correct
  (`ae` may be accepted if the right form is shown).
- Audio: no German voice → hide the play button.
- Mobile first: tap targets ≥ 44px. Reading pages work without JavaScript.
- Code comments: one short line, only the *why*.

## Design

Warm, autumn, cozy: like reading by a window in October. Calm, never flashy.

- Cream paper background, warm brown text, amber/rust/olive accents. Warm dark mode via
  `prefers-color-scheme`. All tokens live in `global.css` and are contrast-tested (WCAG AA).
- Gender colors: der = dusk blue, die = brick red, das = moss green, plural = plum.
  Never color alone: always show the article.
- System fonts, soft corners, thin warm borders, lots of space, respect reduced motion.
- Trainers: one card at a time, big buttons, then a short "why". Friendly, never harsh red.
- Pages: home, `/nouns`, `/cases`, `/sentences`, `/stories`, `/grammar`. Nav shows only
  pages that exist. `/about` is linked from the footer, which credits "legendfinka" and the
  repo. Keep personal details off the site.

## Progress

All in the browser through `src/lib/storage.ts` (key `sd:v1`). Never crash on bad data:
bad entries are dropped, unreadable data resets with a backup, and data from a newer
version is never overwritten (`store.outdated`). If storage is blocked or full, the app
works in memory and says "progress won't be saved" (`store.persistent` is false). Shape change → bump `CURRENT_VERSION` and add a migration.

## Roadmap

Done: scaffold · verification · content checks · design and layout · storage · SRS
(`src/lib/srs.ts`: SM-2, wrong cards return in 10 minutes, `nextItems()` builds the queue) ·
noun trainer (`NounTrainer.astro` island + `noun-trainer.ts`; typed plurals via `grading.ts`;
"Report a mistake" opens a GitHub issue, repo set in `site.ts`) · nouns split into overview
(`/nouns/`, progress per topic via `stats.ts`), topic pages (`/nouns/<topic>/`) and
`/nouns/practice/?topic=…&level=…` · levels inside topics (`levels.ts`; level buttons show
only when a topic has 2+ levels).

6. **Content growth**: A1 nouns to a few hundred, then A2. About 50 per topic file, checked
   in batches (see Adding content). Quizzes and sentences grow with steps 8 and 10.
7. **Answer checking**: grow `src/lib/grading.ts` (plural check exists) for quiz answers.
8. **Case quizzes** on `/cases`.
9. **Grammar pages** on `/grammar`, linked from explanations and `genderRule`.
10. **Sentence breakdown** on `/sentences`.
11. **Sentence builder**, with a tap/keyboard option besides dragging.
12. **Stories** on `/stories`, with audio and questions.
13. **Export / Import** of progress, settings page.
14. **Hosting** with CI running the tests.

Analytics: none in v1. At launch the owner may add cookieless page counts only (Cloudflare
Web Analytics or GoatCounter). Never per-user tracking or ads.
