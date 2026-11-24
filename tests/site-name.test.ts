import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = join(__dirname, '..');

function files(dir: string): string[] {
  return readdirSync(dir).flatMap((f) => {
    const p = join(dir, f);
    return statSync(p).isDirectory() ? files(p) : [p];
  });
}

describe('site name', () => {
  it('is always "Schwieriges Deutsch", never the ungrammatical "SchwierigeDeutsch"', () => {
    const targets = [...files(join(ROOT, 'src')), join(ROOT, 'CLAUDE.md'), join(ROOT, 'package.json')];
    const bad = targets.filter((f) => /schwierige\s*deutsch/i.test(readFileSync(f, 'utf8')));
    expect(bad).toEqual([]);
  });
});
