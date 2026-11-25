// Case quiz topics in page order, each with the short rule shown to learners.
export const CASE_TOPICS = [
  {
    id: 'nom-acc',
    label: 'Nominative & accusative',
    blurb: 'Who does it, and what it is done to.',
    rules: [
      'The subject (who does it) is nominative: Der Mann liest.',
      'The direct object (what it is done to) is accusative: Ich sehe den Mann.',
      'Only masculine articles change: der → den, ein → einen.',
      'After "sein" the noun stays nominative: Das ist ein Tisch.',
    ],
  },
  {
    id: 'dative',
    label: 'Dative',
    blurb: 'Who receives something.',
    rules: [
      'The receiver is dative: Ich gebe dem Kind einen Ball.',
      'der → dem, die → der, das → dem.',
      'Plural: die → den, and the noun usually adds -n: den Kindern.',
      'helfen, danken and gehören always take the dative.',
    ],
  },
  {
    id: 'prepositions',
    label: 'Prepositions',
    blurb: 'Some prepositions always take the same case.',
    rules: [
      'Always accusative: durch, für, gegen, ohne, um.',
      'Always dative: aus, bei, mit, nach, seit, von, zu.',
      'Short forms: zu dem → zum, zu der → zur.',
    ],
  },
  {
    id: 'wo-wohin',
    label: 'Wo? or wohin?',
    blurb: 'Place or direction decides the case.',
    rules: [
      'an, auf, hinter, in, neben, über, unter, vor, zwischen can take either case.',
      'Wo? (where something is) → dative: Das Buch liegt auf dem Tisch.',
      'Wohin? (where it is going) → accusative: Ich lege das Buch auf den Tisch.',
      'Short forms: in dem → im, in das → ins, an dem → am.',
    ],
  },
] as const;

export type CaseTopic = (typeof CASE_TOPICS)[number];
export type CaseTopicId = CaseTopic['id'];

export const CASE_TOPIC_IDS = CASE_TOPICS.map((t) => t.id) as [CaseTopicId, ...CaseTopicId[]];

// Quiz files store topics as "cases/<id>".
export const quizTopic = (id: CaseTopicId) => `cases/${id}`;
