/**
 * Normalizes a written total against the grader who produced it.
 *
 * Each grader's own submitted totals define their mean and spread, and a
 * submission is reported as how many standard deviations it sits above or below
 * that grader's average: the ordinary z-score. Two graders reading the same
 * pool differ mostly in how they use the scale, so removing each one's mean and
 * spread leaves the part that is about the applicant.
 *
 * Two consequences of z worth keeping straight, because both are the intended
 * behaviour rather than bugs:
 *
 * - The model this replaced only removed a grader's offset. Z removes their
 *   spread as well, so a grader who only ever awards 3s and 4s gets stretched
 *   back out across the range. That moves rankings more than subtracting a bias
 *   did.
 * - An applicant's number is the mean of their graders' z values, so with three
 *   graders it has a standard deviation near 1/√3 rather than 1. It is a
 *   ranking signal, and is deliberately not rescaled to hide that.
 */
export type GraderStats = {
  mean: number;
  sd: number;
  submissions: number;
};

/**
 * Pseudo-observations of the pool mixed into every grader's own variance.
 *
 * Only the variance. A grader two applications in can have a spread of nearly
 * zero — two similar totals — and dividing by that turns a one-point difference
 * into a z of several sigma. Their *mean*, by contrast, is well behaved from the
 * first submission, and it is the thing this correction mostly exists to remove,
 * so shrinking it would leave the strictest and most generous graders partly
 * uncorrected for no gain in stability.
 */
export const NORMALIZATION_PRIOR = 5;

/** Below this, a grader's own tendency is not yet worth reporting on screen. */
export const MIN_SUBMISSIONS_FOR_Z = 5;

function moments(totals: number[]) {
  const count = totals.length;
  if (!count) return { mean: 0, variance: 0 };
  const mean = totals.reduce((sum, total) => sum + total, 0) / count;
  // Sample variance; undefined for a single observation, which the prior covers.
  const variance =
    count > 1
      ? totals.reduce((sum, total) => sum + (total - mean) ** 2, 0) / (count - 1)
      : 0;
  return { mean, variance };
}

export function estimateGraderStats(
  submissions: Array<{ graderId: string; total: number }>,
): { pooled: GraderStats; withinSd: number; byGrader: Map<string, GraderStats> } {
  const totalsByGrader = new Map<string, number[]>();
  for (const submission of submissions) {
    const totals = totalsByGrader.get(submission.graderId);
    if (totals) totals.push(submission.total);
    else totalsByGrader.set(submission.graderId, [submission.total]);
  }

  const pool = moments(submissions.map((submission) => submission.total));
  // A pool with no spread at all — every grader gave every applicant the same
  // total — leaves nothing to divide by. Fall back to one, which makes z the
  // raw difference from the mean rather than an infinity.
  const poolSd = Math.sqrt(pool.variance) || 1;
  const pooled: GraderStats = {
    mean: pool.mean,
    sd: poolSd,
    submissions: submissions.length,
  };

  const byGrader = new Map<string, GraderStats>();
  for (const [graderId, totals] of totalsByGrader) {
    const count = totals.length;
    const own = moments(totals);
    const variance =
      (count * own.variance + NORMALIZATION_PRIOR * pool.variance) /
      (count + NORMALIZATION_PRIOR);
    byGrader.set(graderId, {
      mean: own.mean,
      sd: Math.sqrt(variance) || poolSd,
      submissions: count,
    });
  }

  // The spread of a typical grader's own scoring, with the differences
  // *between* graders taken back out. `pooled.sd` mixes the two, so it is the
  // wrong unit for anything travelling back the way a z-score came: a z is
  // measured against one grader's own spread, never the whole set's.
  const variances = [...byGrader.values()].map((stats) => stats.sd ** 2);
  const withinSd = variances.length
    ? Math.sqrt(variances.reduce((sum, value) => sum + value, 0) / variances.length)
    : poolSd;

  return { pooled, withinSd, byGrader };
}

export function zScore(total: number, stats: GraderStats) {
  return (total - stats.mean) / stats.sd;
}
