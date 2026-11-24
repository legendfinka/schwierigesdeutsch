/** Noun topics, in the order they appear on the site. Add new ones here. */
export const TOPICS = [
  { id: 'people', label: 'Family & people' },
  { id: 'food', label: 'Food & drink' },
  { id: 'home', label: 'Home' },
  { id: 'town', label: 'Town & travel' },
  { id: 'time', label: 'Time' },
  { id: 'everyday', label: 'Everyday things' },
] as const;

export type Topic = (typeof TOPICS)[number];
export type TopicId = Topic['id'];

export const TOPIC_IDS = TOPICS.map((t) => t.id) as [TopicId, ...TopicId[]];

/** Groups items by topic in TOPICS order (empty topics left out), A–Z inside each. */
export function groupByTopic<T extends { topic: TopicId; noun: string }>(
  items: readonly T[],
): Array<{ topic: Topic; items: T[] }> {
  return TOPICS.map((topic) => ({
    topic,
    items: items
      .filter((i) => i.topic === topic.id)
      .sort((a, b) => a.noun.localeCompare(b.noun, 'de')),
  })).filter((g) => g.items.length > 0);
}
