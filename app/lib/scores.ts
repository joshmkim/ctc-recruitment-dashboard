export const SCORE_VALUES = [1, 2, 3, 4] as const;

export type ScoreValue = (typeof SCORE_VALUES)[number];

export type ScoreLevel = {
  value: ScoreValue;
  label: string;
};

/** Shared 1–4 labels. What each number means is per-question, on `QUESTIONS`. */
export const SCORE_LEVELS: ScoreLevel[] = [
  { value: 1, label: "Weak" },
  { value: 2, label: "Satisfactory" },
  { value: 3, label: "Good" },
  { value: 4, label: "Strong" },
];

export function isScoreValue(value: unknown): value is ScoreValue {
  return SCORE_VALUES.includes(value as ScoreValue);
}
