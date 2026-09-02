/**
 * Estimates how far each grader tends to score above or below their co-graders.
 *
 * Each observation is a pair of scores for the same applicant, which lets the
 * calculation separate differences in grading style from applicant quality.
 * Ridge regularization keeps graders with little history close to neutral.
 */
export type ScorePair = {
  firstGraderId: string;
  firstTotal: number;
  secondGraderId: string;
  secondTotal: number;
};

export type GraderNormalization = {
  effect: number;
  pairedReviews: number;
};

export const NORMALIZATION_PRIOR_PAIRS = 5;
export const MIN_PAIRED_REVIEWS = 3;

export function estimateGraderEffects(pairs: ScorePair[]): Map<string, GraderNormalization> {
  const connections = new Map<string, Map<string, number>>();
  const totals = new Map<string, number>();
  const pairedReviews = new Map<string, number>();

  function add(graderId: string, otherGraderId: string, difference: number) {
    const neighbors = connections.get(graderId) ?? new Map<string, number>();
    neighbors.set(otherGraderId, (neighbors.get(otherGraderId) ?? 0) + 1);
    connections.set(graderId, neighbors);
    totals.set(graderId, (totals.get(graderId) ?? 0) + difference);
    pairedReviews.set(graderId, (pairedReviews.get(graderId) ?? 0) + 1);
  }

  for (const pair of pairs) {
    if (pair.firstGraderId === pair.secondGraderId) continue;
    const difference = pair.firstTotal - pair.secondTotal;
    add(pair.firstGraderId, pair.secondGraderId, difference);
    add(pair.secondGraderId, pair.firstGraderId, -difference);
  }

  const effects = new Map<string, number>(
    [...connections.keys()].map((graderId) => [graderId, 0]),
  );

  // Gauss–Seidel solves the ridge-regularized least-squares normal equations.
  // This small, fixed iteration count converges rapidly for the sparse grading
  // graph and avoids adding a matrix dependency.
  for (let iteration = 0; iteration < 100; iteration += 1) {
    for (const [graderId, neighbors] of connections) {
      const neighborEffects = [...neighbors].reduce(
        (sum, [otherId, count]) => sum + count * (effects.get(otherId) ?? 0),
        0,
      );
      const count = pairedReviews.get(graderId) ?? 0;
      effects.set(
        graderId,
        ((totals.get(graderId) ?? 0) + neighborEffects) /
          (count + NORMALIZATION_PRIOR_PAIRS),
      );
    }
  }

  return new Map(
    [...effects].map(([graderId, effect]) => [
      graderId,
      { effect, pairedReviews: pairedReviews.get(graderId) ?? 0 },
    ]),
  );
}

export function normalizeTotal(total: number, effect: number, maximum: number) {
  return Math.min(maximum, Math.max(0, total - effect));
}
