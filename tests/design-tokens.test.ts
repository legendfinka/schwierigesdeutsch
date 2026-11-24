import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

/**
 * Reads the color tokens from global.css (light = first :root, dark = the
 * prefers-color-scheme: dark block) and checks WCAG contrast for every text color
 * on every background, in both themes.
 */
const css = readFileSync(join(__dirname, '..', 'src', 'styles', 'global.css'), 'utf8');
const [lightPart, darkPart] = css.split('@media (prefers-color-scheme: dark)');

function tokens(part: string | undefined): Record<string, string> {
  const out: Record<string, string> = {};
  for (const m of (part ?? '').matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{6})\s*;/g)) {
    out[m[1]!] = m[2]!.toLowerCase();
  }
  return out;
}

function luminance(hex: string): number {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  }) as [number, number, number];
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (hi + 0.05) / (lo + 0.05);
}

const TEXT = ['text', 'text-muted', 'accent', 'gender-m', 'gender-f', 'gender-n', 'gender-pl'];
const BACKGROUNDS = ['bg', 'surface', 'surface-sunk'];

describe('contrast helper', () => {
  it('matches known values', () => {
    expect(contrast('#000000', '#ffffff')).toBeCloseTo(21, 1);
    expect(contrast('#777777', '#ffffff')).toBeCloseTo(4.48, 1);
  });
});

describe.each([
  ['light', tokens(lightPart)],
  ['dark', tokens(darkPart)],
])('%s theme', (_name, t) => {
  it('defines every color token', () => {
    for (const name of [...TEXT, ...BACKGROUNDS, 'border', 'accent-soft', 'focus']) {
      expect(t[name], `--${name}`).toMatch(/^#[0-9a-f]{6}$/);
    }
  });

  it('text colors reach WCAG AA (4.5:1) on every background', () => {
    const fails: string[] = [];
    for (const fg of TEXT) {
      for (const bg of [...BACKGROUNDS, 'accent-soft']) {
        // accent-soft is only used behind the current nav item (text color)
        if (bg === 'accent-soft' && fg !== 'text') continue;
        const ratio = contrast(t[fg]!, t[bg]!);
        if (ratio < 4.5) fails.push(`--${fg} on --${bg}: ${ratio.toFixed(2)}`);
      }
    }
    expect(fails).toEqual([]);
  });

  it('focus ring reaches 3:1 on backgrounds (non-text contrast)', () => {
    for (const bg of BACKGROUNDS) {
      expect(contrast(t.focus!, t[bg]!), `--focus on --${bg}`).toBeGreaterThanOrEqual(3);
    }
  });

  it('each gender has its own color', () => {
    // Color is never the only signal (article text is always shown); this just
    // guards against two genders accidentally getting the same color.
    const g = ['gender-m', 'gender-f', 'gender-n', 'gender-pl'].map((k) => t[k]);
    expect(new Set(g).size).toBe(4);
  });
});
