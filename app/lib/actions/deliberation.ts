"use server";

import { requireAdmin, requireIdentity } from "@/lib/admin-auth";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";
import { getApplicant, getApplicants } from "@/lib/applications";
import type { Decision } from "@/lib/actions/admin";
import { type AssignmentSlot } from "@/lib/grading";
import { QUESTION_IDS } from "@/lib/questions";
import {
  estimateGraderStats,
  MIN_SUBMISSIONS_FOR_Z,
  zScore,
  type GraderStats,
} from "@/lib/score-normalization";
import { selectAllRows, supabase } from "@/lib/supabase";

type ScoreRow = {
  set_id: string;
  applicant_id: string;
  grader_id: string;
  q1_score: number;
  q2_score: number;
  q3_score: number;
  q4_score: number;
  q5_score: number;
  comments: string | null;
};

type AssignmentRow = {
  set_id: string;
  applicant_id: string;
  grader_id: string;
  slot: AssignmentSlot;
};

export type GraderSubmission = {
  slot: AssignmentSlot;
  graderId: string;
  graderName: string;
  submitted: boolean;
  /** Empty until this grader submits. */
  values: number[];
  overall: number;
  total: number;
  comments: string;
  /** This grader's own average and spread across the set. */
  stats: GraderStats;
  /** Points this grader's average sits above (generous) or below (strict) the
   *  average across the whole set. Only for display — the z-score already
   *  accounts for it. */
  tendency: number;
  /** How far this submission sits from that grader's own average, in standard
   *  deviations. Zero until they submit. */
  z: number;
  hasSufficientHistory: boolean;
};

export type DeliberationApplicant = {
  id: string;
  /** Three-letter alias. The default label in this view. */
  name: string;
  /** Real name from the form. Shown only when the admin unmasks names, and
   *  null on the shared board, which never gets to see one. */
  fullName: string | null;
  graduationYear: string | null;
  resumeUrl: string | null;
  role: string | null;
  /** One entry per filled slot, in slot order, so the graders keep the same
   *  position across renders. Shorter than the set's arity only when an
   *  applicant is missing an assignment, which the view reports as a problem. */
  graders: GraderSubmission[];
  assignedCount: number;
  scoredCount: number;
  /** How many graders this applicant's set gives each applicant. */
  gradersPerApplicant: number;
  /** Every slot assigned and every grader submitted — safe to deliberate on. */
  ready: boolean;
  questionAverages: number[];
  /** The spread between the highest and lowest grader on each question. Empty
   *  until everyone submits. A large gap on one question is the signal worth
   *  discussing, and it disappears into an average of averages. */
  questionGaps: number[];
  maxGap: number;
  overallAverage: number;
  /** Mean of the graders' z-scores. Null until every grader submits. */
  normalizedZ: number | null;
  /** That same figure on the 5–20 point scale, for reading beside the raw
   *  total. Rank on `normalizedZ` — this one is clamped at the ends. */
  normalizedTotal: number | null;
  decision: Decision | null;
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

const scoreValues = (row: ScoreRow) => [
  row.q1_score,
  row.q2_score,
  row.q3_score,
  row.q4_score,
  row.q5_score,
];
const total = (values: number[]) => values.reduce((sum, value) => sum + value, 0);

/** A total is five questions scored 1–4, so it can only land in 5..20. */
const TOTAL_MIN = QUESTION_IDS.length;
const TOTAL_MAX = QUESTION_IDS.length * 4;

/**
 * Puts a normalized score back on the 5–20 point scale, so it can be read
 * against the raw total instead of only against itself.
 *
 * The scale factor is the *within-grader* spread, not the pool's. A z says how
 * far a total sat from its own grader's average, measured in that grader's own
 * spread, so turning it back into points has to multiply by the same quantity.
 * `pooled.sd` also carries the variation between graders, and using it stretches
 * every applicant away from the middle by however much the graders disagreed
 * with each other — which is precisely what this correction exists to remove.
 */
const normalizedTotalOf = (z: number, pooled: GraderStats, withinSd: number) =>
  Math.min(TOTAL_MAX, Math.max(TOTAL_MIN, pooled.mean + z * withinSd));

type ScoreContext = {
  slotsByApplicant: Map<string, AssignmentRow[]>;
  scoresByAssignment: Map<string, ScoreRow>;
  graderNames: Map<string, string>;
  graderStats: Map<string, GraderStats>;
  /** Average and spread across every submission in the set. The reference
   *  point for calling a grader generous or strict, and the fallback for one
   *  with no history of their own. */
  pooled: GraderStats;
  /** Spread of a typical grader's own scoring, the unit a z-score is in. */
  withinSd: number;
  gradersPerApplicant: number;
};

type ApplicantScoreSummary = {
  graders: GraderSubmission[];
  assignedCount: number;
  scoredCount: number;
  gradersPerApplicant: number;
  ready: boolean;
  questionAverages: number[];
  questionGaps: number[];
  maxGap: number;
  overallAverage: number;
  normalizedZ: number | null;
  /** The same figure as `normalizedZ`, mapped back onto the 5–20 point scale.
   *  For reading beside the raw total; rank on `normalizedZ`, which is not
   *  clamped and so never ties two applicants at the ends. */
  normalizedTotal: number | null;
};

async function loadScoreContext(
  setId: string,
  gradersPerApplicant: number,
): Promise<ScoreContext> {
  // Averages and coverage are computed from every row, so a partial read here
  // would quietly change the numbers the club deliberates on.
  const [assignmentsResult, scoresResult, gradersResult] = await Promise.all([
    selectAllRows<AssignmentRow>(
      "assignments",
      "set_id, applicant_id, grader_id, slot",
      "id",
      { column: "set_id", value: setId },
    ),
    selectAllRows<ScoreRow>(
      "written_scores",
      "set_id, applicant_id, grader_id, q1_score, q2_score, q3_score, q4_score, q5_score, comments",
      "id",
      { column: "set_id", value: setId },
    ),
    supabase.from("graders").select("id, name"),
  ]);

  for (const result of [assignmentsResult, scoresResult, gradersResult]) {
    if (result.error) throw new Error(`Could not load deliberation data: ${result.error.message}`);
  }

  const graderNames = new Map((gradersResult.data ?? []).map((grader) => [grader.id, grader.name]));
  const slotsByApplicant = new Map<string, AssignmentRow[]>();
  for (const assignment of assignmentsResult.data ?? []) {
    const existing = slotsByApplicant.get(assignment.applicant_id);
    if (existing) existing.push(assignment);
    else slotsByApplicant.set(assignment.applicant_id, [assignment]);
  }

  // Assignments decide whose score counts. Grader identity is unverified, so a
  // score can arrive from someone who was never assigned; keying off the
  // assignment keeps a stray row out of the averages.
  const scoresByAssignment = new Map(
    (scoresResult.data ?? []).map((score) => [
      `${score.applicant_id}:${score.grader_id}`,
      score,
    ]),
  );

  // Every submission a grader made counts toward their own mean and spread,
  // including ones on applicants nobody else has finished yet. Waiting for a
  // complete applicant, as the old pairwise model had to, would throw away most
  // of the history early in a grading round.
  const submissions: Array<{ graderId: string; total: number }> = [];
  for (const [applicantId, assigned] of slotsByApplicant) {
    for (const assignment of assigned) {
      const score = scoresByAssignment.get(`${applicantId}:${assignment.grader_id}`);
      if (!score) continue;
      submissions.push({
        graderId: assignment.grader_id,
        total: total(scoreValues(score)),
      });
    }
  }

  const { pooled, withinSd, byGrader } = estimateGraderStats(submissions);

  return {
    slotsByApplicant,
    scoresByAssignment,
    graderNames,
    graderStats: byGrader,
    pooled,
    withinSd,
    gradersPerApplicant,
  };
}

function scoresForApplicant(
  applicantId: string,
  ctx: ScoreContext,
): ApplicantScoreSummary {
  const slots = [...(ctx.slotsByApplicant.get(applicantId) ?? [])].sort(
    (left, right) => left.slot - right.slot,
  );

  const graders: GraderSubmission[] = slots.map((assignment) => {
    const score = ctx.scoresByAssignment.get(`${applicantId}:${assignment.grader_id}`);
    const values = score ? scoreValues(score) : [];
    const stats = ctx.graderStats.get(assignment.grader_id) ?? ctx.pooled;
    const graderTotal = total(values);
    return {
      slot: assignment.slot,
      graderId: assignment.grader_id,
      graderName: ctx.graderNames.get(assignment.grader_id) ?? "Unknown grader",
      submitted: Boolean(score),
      values,
      overall: average(values),
      total: graderTotal,
      comments: score?.comments?.trim() ?? "",
      stats,
      tendency: stats.mean - ctx.pooled.mean,
      z: score ? zScore(graderTotal, stats) : 0,
      hasSufficientHistory: stats.submissions >= MIN_SUBMISSIONS_FOR_Z,
    };
  });

  const { gradersPerApplicant } = ctx;
  const submitted = graders.filter((grader) => grader.submitted);
  const questionAverages = QUESTION_IDS.map((_, index) =>
    average(submitted.map((grader) => grader.values[index])),
  );
  const normalizedZ =
    submitted.length === gradersPerApplicant
      ? average(submitted.map((grader) => grader.z))
      : null;

  // The spread, not a difference: with three graders the pair furthest apart is
  // the disagreement worth talking about.
  const questionGaps =
    submitted.length === gradersPerApplicant
      ? QUESTION_IDS.map((_, index) => {
          const values = submitted.map((grader) => grader.values[index]);
          return Math.max(...values) - Math.min(...values);
        })
      : [];

  return {
    graders,
    assignedCount: slots.length,
    scoredCount: submitted.length,
    gradersPerApplicant,
    ready:
      slots.length === gradersPerApplicant && submitted.length === gradersPerApplicant,
    questionAverages,
    questionGaps,
    maxGap: questionGaps.length ? Math.max(...questionGaps) : 0,
    overallAverage: average(questionAverages),
    normalizedZ,
    normalizedTotal:
      normalizedZ === null
        ? null
        : normalizedTotalOf(normalizedZ, ctx.pooled, ctx.withinSd),
  };
}

export async function getWrittenScoreSummary(
  applicantId: string,
  setId: string,
  gradersPerApplicant: number,
): Promise<ApplicantScoreSummary> {
  await requireAdmin();
  const ctx = await loadScoreContext(setId, gradersPerApplicant);
  return scoresForApplicant(applicantId, ctx);
}

/**
 * Every applicant with their scores, normalization and decision.
 *
 * `includeNames` is false for the shared board, which shows aliases only. The
 * real name and the resume link are dropped here rather than hidden in the
 * browser, so a page that will not render them never receives them.
 */
async function loadDeliberationApplicants(
  { includeNames }: { includeNames: boolean },
): Promise<DeliberationApplicant[]> {
  const set = await requireActiveApplicantSet();

  const [applicants, ctx, decisionsResult] = await Promise.all([
    getApplicants(set.id),
    loadScoreContext(set.id, set.gradersPerApplicant),
    supabase.from("decisions").select("applicant_id, decision").eq("set_id", set.id),
  ]);

  if (decisionsResult.error) {
    throw new Error(`Could not load deliberation data: ${decisionsResult.error.message}`);
  }

  const decisions = new Map(
    (decisionsResult.data ?? []).map((item) => [item.applicant_id, item.decision as Decision]),
  );

  return applicants.map((applicant) => {
    const scores = scoresForApplicant(applicant.id, ctx);
    return {
      id: applicant.id,
      name: applicant.name,
      fullName: includeNames ? applicant.fullName ?? applicant.name : null,
      graduationYear: applicant.profile.graduationYear,
      resumeUrl: includeNames ? applicant.profile.resumeUrl : null,
      role: applicant.profile.role,
      ...scores,
      decision: decisions.get(applicant.id) ?? null,
    };
  });
}

export async function getDeliberationApplicants(): Promise<DeliberationApplicant[]> {
  await requireAdmin();
  return loadDeliberationApplicants({ includeNames: true });
}

/** The same board for the whole club, at `/deliberation`, without names. */
export async function getSharedDeliberationApplicants(): Promise<DeliberationApplicant[]> {
  await requireIdentity();
  return loadDeliberationApplicants({ includeNames: false });
}

/**
 * Just the decisions, for the shared board to poll while an admin sets them.
 *
 * A few hundred short strings, against the megabytes of essays and grader rows
 * a full reload of the board costs — which is why only this part refreshes on
 * its own.
 *
 * Reads the set the caller was rendered for rather than whatever is active now,
 * so the decision column stays consistent with the scores beside it if a set is
 * archived while the board is open.
 */
export async function getDecisions(setId: string): Promise<Record<string, Decision>> {
  await requireIdentity();

  const { data, error } = await supabase
    .from("decisions")
    .select("applicant_id, decision")
    .eq("set_id", setId);
  if (error) throw new Error(`Could not load decisions: ${error.message}`);

  return Object.fromEntries(
    (data ?? []).map((item) => [item.applicant_id, item.decision as Decision]),
  );
}

export type WrittenApplication = {
  responses: Record<(typeof QUESTION_IDS)[number], string>;
  commitments: string | null;
};

/**
 * Deliberately readable by any grader, not just an assigned one: the shared
 * board exists so the club can read an application together while deciding on
 * it. `/score/[applicantId]` still narrows to the applicants a grader was
 * given — that page is for scoring, where reading the rest of the pool has no
 * purpose.
 */
export async function getWrittenApplication(
  applicantId: string,
): Promise<WrittenApplication> {
  await requireIdentity();
  const applicant = await getApplicant(applicantId);
  if (!applicant) throw new Error("Applicant was not found.");
  return {
    responses: applicant.responses,
    commitments: applicant.profile.commitments,
  };
}
