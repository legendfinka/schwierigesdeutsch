import { describe, expect, it } from 'vitest';
import { checkPlural } from '../src/lib/grading';

describe('checkPlural', () => {
  it('exact match', () => {
    expect(checkPlural('Tische', 'Tische')).toBe('exact');
  });
  it('ignores spaces around the answer', () => {
    expect(checkPlural('  Tische ', 'Tische')).toBe('exact');
  });
  it('accepts a leading "die"', () => {
    expect(checkPlural('die Tische', 'Tische')).toBe('exact');
    expect(checkPlural('Die  Tische', 'Tische')).toBe('exact');
  });
  it('accepts wrong capitals but asks to show the real form', () => {
    expect(checkPlural('tische', 'Tische')).toBe('close');
  });
  it('accepts ae/oe/ue/ss for umlauts and ß', () => {
    expect(checkPlural('Maenner', 'Männer')).toBe('close');
    expect(checkPlural('Boeden', 'Böden')).toBe('close');
    expect(checkPlural('Fuesse', 'Füße')).toBe('close');
    expect(checkPlural('Fusse', 'Füße')).toBe('wrong');
  });
  it('a missing umlaut is wrong', () => {
    expect(checkPlural('Manner', 'Männer')).toBe('wrong');
    expect(checkPlural('Fuße', 'Füße')).toBe('wrong');
  });
  it('composed and decomposed umlauts are the same', () => {
    expect(checkPlural('Männer', 'Männer')).toBe('exact');
  });
  it('empty or only "die" is wrong', () => {
    expect(checkPlural('', 'Tische')).toBe('wrong');
    expect(checkPlural('   ', 'Tische')).toBe('wrong');
    expect(checkPlural('die', 'Tische')).toBe('wrong');
  });
  it('a different word is wrong', () => {
    expect(checkPlural('Tisch', 'Tische')).toBe('wrong');
    expect(checkPlural('Tischen', 'Tische')).toBe('wrong');
  });
});
