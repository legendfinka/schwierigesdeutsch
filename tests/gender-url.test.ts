import { describe, expect, it } from 'vitest';
import { ARTICLE, GENDER_LABEL, pluralText } from '../src/lib/gender';
import { GENDERS } from '../src/lib/schemas';
import { url } from '../src/lib/url';

describe('gender', () => {
  it('has an article and label for every gender', () => {
    for (const g of GENDERS) {
      expect(ARTICLE[g]).toMatch(/^(der|die|das)$/);
      expect(GENDER_LABEL[g]).toBeTruthy();
    }
  });
  it('uses the right articles', () => {
    expect(ARTICLE).toEqual({ m: 'der', f: 'die', n: 'das', pl: 'die' });
  });
  it('describes the plural', () => {
    expect(pluralText({ plural: 'Tische' })).toBe('die Tische');
    expect(pluralText({ plural: null })).toBe('no plural');
    expect(pluralText({ plural: 'Leute', pluralOnly: true })).toBe('only plural');
  });
});

describe('url', () => {
  it('joins with the root base', () => {
    expect(url('/', '/')).toBe('/');
    expect(url('/nouns/', '/')).toBe('/nouns/');
  });
  it('joins with a sub-folder base, with or without slashes', () => {
    expect(url('/nouns/', '/deutsch/')).toBe('/deutsch/nouns/');
    expect(url('nouns/', '/deutsch')).toBe('/deutsch/nouns/');
    expect(url('/', '/deutsch/')).toBe('/deutsch/');
  });
});
