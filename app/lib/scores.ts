export const SCORE_VALUES = [1, 2, 3, 4] as const;

export type ScoreValue = (typeof SCORE_VALUES)[number];

export type ScoreLevel = {
  value: ScoreValue;
  label: string;
  /** Rubric text shown once this level is selected. */
  description: string;
};

// TODO: replace the descriptions with the real rubric copy. See TODO.md.
export const SCORE_LEVELS: ScoreLevel[] = [
  {
    value: 1,
    label: "Weak",
    description: "Rubric description pending.",
  },
  {
    value: 2,
    label: "Satisfactory",
    description: "Rubric description pending.",
  },
  {
    value: 3,
    label: "Good",
    description: "Rubric description pending.",
  },
  {
    value: 4,
    label: "Strong",
    description: "Rubric description pending.",
  },
];

export function isScoreValue(value: unknown): value is ScoreValue {
  return SCORE_VALUES.includes(value as ScoreValue);
}
