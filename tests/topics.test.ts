import { describe, expect, it } from 'vitest';
import { TOPICS, TOPIC_IDS, groupByTopic } from '../src/lib/topics';

describe('topics', () => {
  it('has unique ids and labels', () => {
    expect(new Set(TOPIC_IDS).size).toBe(TOPICS.length);
    expect(new Set(TOPICS.map((t) => t.label)).size).toBe(TOPICS.length);
  });
  it('ids are safe for #anchors and urls', () => {
    for (const id of TOPIC_IDS) expect(id).toMatch(/^[a-z][a-z0-9-]*$/);
  });
  it('no topic page clashes with /nouns/practice/', () => {
    expect(TOPIC_IDS).not.toContain('practice');
  });
});

describe('groupByTopic', () => {
  const items = [
    { noun: 'Zug', topic: 'town' as const },
    { noun: 'Vater', topic: 'people' as const },
    { noun: 'Äpfel', topic: 'food' as const },
    { noun: 'Bus', topic: 'town' as const },
    { noun: 'Apfel', topic: 'food' as const },
  ];
  it('keeps the TOPICS order and leaves out empty topics', () => {
    expect(groupByTopic(items).map((g) => g.topic.id)).toEqual(['people', 'food', 'town']);
  });
  it('sorts A–Z inside a topic, German style (Ä next to A)', () => {
    const food = groupByTopic(items).find((g) => g.topic.id === 'food')!;
    expect(food.items.map((i) => i.noun)).toEqual(['Apfel', 'Äpfel']);
    const town = groupByTopic(items).find((g) => g.topic.id === 'town')!;
    expect(town.items.map((i) => i.noun)).toEqual(['Bus', 'Zug']);
  });
  it('does not change the input', () => {
    const copy = items.map((i) => i.noun);
    groupByTopic(items);
    expect(items.map((i) => i.noun)).toEqual(copy);
  });
  it('returns nothing for no items', () => {
    expect(groupByTopic([])).toEqual([]);
  });
});
