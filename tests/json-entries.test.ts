import { describe, expect, it } from 'vitest';
import { collectEntries } from '../src/lib/json-entries';

describe('collectEntries', () => {
  it('accepts a single object and an array', () => {
    const out = collectEntries('nouns', [
      { file: 'a.json', raw: { id: 'a' } },
      { file: 'b.json', raw: [{ id: 'b' }, { id: 'c' }] },
    ]);
    expect(out.map((e) => e.id)).toEqual(['a', 'b', 'c']);
  });
  it('returns nothing for no files', () => {
    expect(collectEntries('nouns', [])).toEqual([]);
  });
  it('rejects a duplicate id, even across files', () => {
    expect(() =>
      collectEntries('nouns', [
        { file: 'a.json', raw: [{ id: 'x' }] },
        { file: 'b.json', raw: { id: 'x' } },
      ]),
    ).toThrow(/duplicate id "x".*a\.json/);
  });
  it('rejects a missing or non-string id', () => {
    expect(() => collectEntries('nouns', [{ file: 'a.json', raw: {} }])).toThrow(/without a string id/);
    expect(() => collectEntries('nouns', [{ file: 'a.json', raw: { id: 5 } }])).toThrow(/without a string id/);
    expect(() => collectEntries('nouns', [{ file: 'a.json', raw: { id: '' } }])).toThrow(/without a string id/);
  });
  it('rejects null, numbers, strings and nested arrays with a clear message', () => {
    for (const bad of [null, 3, 'x', [[]]]) {
      expect(() => collectEntries('nouns', [{ file: 'a.json', raw: [bad] }])).toThrow(
        /nouns\/a\.json \[#0\]: entry must be an object/,
      );
    }
    expect(() => collectEntries('nouns', [{ file: 'a.json', raw: null }])).toThrow(/must be an object/);
  });
});
