// Regroups src/content/nouns into <level>/<topic>.json, sorted A–Z.
// Dry run by default. Pass --write to change files.
import { existsSync, mkdirSync, readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', 'src', 'content');
const DIR = join(ROOT, 'nouns');
const TMP = join(ROOT, '.nouns-new');
const write = process.argv.includes('--write');

const files = readdirSync(DIR, { recursive: true, encoding: 'utf8' }).filter((f) => f.endsWith('.json'));
const entries = files.flatMap((f) => {
  const raw = JSON.parse(readFileSync(join(DIR, f), 'utf8'));
  return Array.isArray(raw) ? raw : [raw];
});

const ids = new Set(entries.map((e) => e.id));
if (ids.size !== entries.length) throw new Error('duplicate ids, fix those first');

const groups = new Map();
for (const e of entries) {
  const key = `${e.level.toLowerCase()}/${e.topic}.json`;
  groups.set(key, [...(groups.get(key) ?? []), e]);
}

const sorted = [...groups].sort(([a], [b]) => a.localeCompare(b));
console.log(`${entries.length} nouns in ${files.length} files -> ${sorted.length} files`);
for (const [key, items] of sorted) console.log(`  ${key}  ${items.length}`);

if (!write) {
  console.log('\nDry run. Run again with --write to apply.');
  process.exit(0);
}

// Write the new tree first, check it, and only then swap.
rmSync(TMP, { recursive: true, force: true });
for (const [key, items] of sorted) {
  items.sort((a, b) => a.noun.localeCompare(b.noun, 'de'));
  const path = join(TMP, key);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `[\n${items.map((e) => `  ${JSON.stringify(e)}`).join(',\n')}\n]\n`);
}

const back = readdirSync(TMP, { recursive: true, encoding: 'utf8' })
  .filter((f) => f.endsWith('.json'))
  .flatMap((f) => JSON.parse(readFileSync(join(TMP, f), 'utf8')));
if (back.length !== entries.length) throw new Error('count mismatch, nothing changed');

rmSync(DIR, { recursive: true });
renameSync(TMP, DIR);
console.log('Done.');
if (existsSync(TMP)) rmSync(TMP, { recursive: true });
