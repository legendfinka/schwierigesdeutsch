// Checks typed German answers. Pure, no DOM.

// exact = same spelling. close = right word, but caps or ae/oe/ue/ss: accept and show the real form.
export type TextVerdict = 'exact' | 'close' | 'wrong';

const SPELLED: Record<string, string> = { ä: 'ae', ö: 'oe', ü: 'ue', ß: 'ss' };

const clean = (s: string) => s.normalize('NFC').trim().replace(/\s+/g, ' ');
const spellOut = (s: string) => s.replace(/[äöüß]/g, (c) => SPELLED[c] ?? c);

// "die Tische" is fine when only the plural is asked.
const withoutDie = (s: string) => s.replace(/^die\s+(?=\S)/i, '');

// A missing umlaut (Manner for Männer) is wrong. Only ae/oe/ue/ss stand in for them.
export function checkPlural(typed: string, correct: string): TextVerdict {
  const t = withoutDie(clean(typed));
  const c = clean(correct);
  if (t === '') return 'wrong';
  if (t === c) return 'exact';
  const lower = t.toLowerCase();
  if (lower === c.toLowerCase() || lower === spellOut(c.toLowerCase())) return 'close';
  return 'wrong';
}
