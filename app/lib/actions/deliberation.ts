"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";
import { getApplicant, getApplicants } from "@/lib/applications";
import type { Decision } from "@/lib/actions/admin";
import { GRADERS_PER_APPLICANT, type AssignmentSlot } from "@/lib/grading";
import { QUESTION_IDS } from "@/lib/questions";
import {
  estimateGraderEffects,
  MIN_PAIRED_REVIEWS,
  normalizeTotal,
  type GraderNormalization,
  type ScorePair,
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
  normalization: GraderNormalization;
  hasSufficientHistory: boolean;
};

export type DeliberationApplicant = {
  id: string;
  /** Three-letter alias. The default label in this view. */
  name: string;
  /** Real name from the form. Shown only when the admin unmasks names. */
  fullName: string;
  graduationYear: string | null;
  resumeUrl: string | null;
  role: string | null;
  /** One entry per filled slot, in slot order, so the two graders keep the same
   *  position across renders. Shorter than `GRADERS_PER_APPLICANT` only when an
   *  applicant is missing an assignment, which the view reports as a problem. */
  graders: GraderSubmission[];
  assignedCount: number;
  scoredCount: number;
  /** Both slots assigned and both graders submitted — safe to deliberate on. */
  ready: boolean;
  questionAverages: number[];
  /** How far apart the two graders are on each question. Empty until both
   *  submit. A large gap on one question is the signal worth discussing, and it
   *  disappears into an average of averages. */
  questionGaps: number[];
  maxGap: number;
  overallAverage: number;
  /** Adjusted total out of 20. Empty until both graders submit. */
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
const NEUTRAL_NORMALIZATION: GraderNormalization = { effect: 0, pairedReviews: 0 };

type ScoreContext = {
  slotsByApplicant: Map<string, AssignmentRow[]>;
  scoresByAssignment: Map<string, ScoreRow>;
  graderNames: Map<string, string>;
  graderEffects: Map<string, GraderNormalization>;
};

type ApplicantScoreSummary = {
  graders: GraderSubmission[];
  assignedCount: number;
  scoredCount: number;
  ready: boolean;
  questionAverages: number[];
  questionGaps: number[];
  maxGap: number;
  overallAverage: number;
  normalizedTotal: number | null;
};

async function loadScoreContext(setId: string): Promise<ScoreContext> {
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

  const pairs: ScorePair[] = [];
  for (const [applicantId, assigned] of slotsByApplicant) {
    const slots = [...assigned].sort((left, right) => left.slot - right.slot);
    if (slots.length !== GRADERS_PER_APPLICANT) continue;
    const first = slots[0];
    const second = slots[1];
    const firstScore = scoresByAssignment.get(`${applicantId}:${first.grader_id}`);
    const secondScore = scoresByAssignment.get(`${applicantId}:${second.grader_id}`);
    if (!firstScore || !secondScore) continue;
    pairs.push({
      firstGraderId: first.grader_id,
      firstTotal: total(scoreValues(firstScore)),
      secondGraderId: second.grader_id,
      secondTotal: total(scoreValues(secondScore)),
    });
  }

  return {
    slotsByApplicant,
    scoresByAssignment,
    graderNames,
    graderEffects: estimateGraderEffects(pairs),
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
    const normalization = ctx.graderEffects.get(assignment.grader_id) ?? NEUTRAL_NORMALIZATION;
    return {
      slot: assignment.slot,
      graderId: assignment.grader_id,
      graderName: ctx.graderNames.get(assignment.grader_id) ?? "Unknown grader",
      submitted: Boolean(score),
      values,
      overall: average(values),
      total: total(values),
      comments: score?.comments?.trim() ?? "",
      normalization,
      hasSufficientHistory: normalization.pairedReviews >= MIN_PAIRED_REVIEWS,
    };
  });

  const submitted = graders.filter((grader) => grader.submitted);
  const questionAverages = QUESTION_IDS.map((_, index) =>
    average(submitted.map((grader) => grader.values[index])),
  );
  const questionGaps =
    submitted.length === GRADERS_PER_APPLICANT
      ? QUESTION_IDS.map((_, index) =>
          Math.abs(submitted[0].values[index] - submitted[1].values[index]),
        )
      : [];

  return {
    graders,
    assignedCount: slots.length,
    scoredCount: submitted.length,
    ready:
      slots.length === GRADERS_PER_APPLICANT &&
      submitted.length === GRADERS_PER_APPLICANT,
    questionAverages,
    questionGaps,
    maxGap: questionGaps.length ? Math.max(...questionGaps) : 0,
    overallAverage: average(questionAverages),
    normalizedTotal:
      submitted.length === GRADERS_PER_APPLICANT
        ? average(
            submitted.map((grader) =>
              normalizeTotal(
                grader.total,
                grader.normalization.effect,
                QUESTION_IDS.length * 4,
              ),
            ),
          )
        : null,
  };
}

export async function getWrittenScoreSummary(
  applicantId: string,
  setId: string,
): Promise<ApplicantScoreSummary> {
  await requireAdmin();
  const ctx = await loadScoreContext(setId);
  return scoresForApplicant(applicantId, ctx);
}

export async function getDeliberationApplicants(): Promise<DeliberationApplicant[]> {
  await requireAdmin();
  const set = await requireActiveApplicantSet();

  const [applicants, ctx, decisionsResult] = await Promise.all([
    getApplicants(set.id),
    loadScoreContext(set.id),
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
      fullName: applicant.fullName ?? applicant.name,
      graduationYear: applicant.profile.graduationYear,
      resumeUrl: applicant.profile.resumeUrl,
      role: applicant.profile.role,
      ...scores,
      decision: decisions.get(applicant.id) ?? null,
    };
  });
}

export type WrittenApplication = {
  responses: Record<(typeof QUESTION_IDS)[number], string>;
  commitments: string | null;
};

export async function getWrittenApplication(
  applicantId: string,
): Promise<WrittenApplication> {
  await requireAdmin();
  const applicant = await getApplicant(applicantId);
  if (!applicant) throw new Error("Applicant was not found.");
  return {
    responses: applicant.responses,
    commitments: applicant.profile.commitments,
  };
}
