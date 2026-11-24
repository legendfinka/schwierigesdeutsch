import { describe, expect, it } from 'vitest';
import { isCurrentPath } from '../src/lib/nav';

describe('isCurrentPath', () => {
  it('matches with or without a trailing slash', () => {
    expect(isCurrentPath('/nouns/', '/nouns/', '/')).toBe(true);
    expect(isCurrentPath('/nouns/', '/nouns', '/')).toBe(true);
  });
  it('matches sub-pages', () => {
    expect(isCurrentPath('/nouns/', '/nouns/tisch/', '/')).toBe(true);
  });
  it('does not match a page that only starts with the same letters', () => {
    expect(isCurrentPath('/nouns/', '/nounsx/', '/')).toBe(false);
  });
  it('home is current only on home', () => {
    expect(isCurrentPath('/', '/', '/')).toBe(true);
    expect(isCurrentPath('/', '/nouns/', '/')).toBe(false);
  });
  it('works under a sub-folder base', () => {
    expect(isCurrentPath('/de/', '/de', '/de/')).toBe(true);
    expect(isCurrentPath('/de/', '/de/nouns/', '/de/')).toBe(false);
    expect(isCurrentPath('/de/nouns/', '/de/nouns', '/de/')).toBe(true);
  });
});
