"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { getApplicants } from "@/lib/applications";
import type { Decision } from "@/lib/actions/admin";
import { GRADERS_PER_APPLICANT, type AssignmentSlot } from "@/lib/grading";
import { QUESTION_IDS } from "@/lib/questions";
import { selectAllRows, supabase } from "@/lib/supabase";

type ScoreRow = {
  applicant_id: string;
  grader_id: string;
  q1_score: number;
  q2_score: number;
  q3_score: number;
  q4_score: number;
  q5_score: number;
};

type AssignmentRow = {
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
};

export type DeliberationApplicant = {
  id: string;
  name: string;
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

export async function getDeliberationApplicants(): Promise<DeliberationApplicant[]> {
  await requireAdmin();

  // Averages and coverage are computed from every row, so a partial read here
  // would quietly change the numbers the club deliberates on.
  const [applicants, assignmentsResult, scoresResult, gradersResult, decisionsResult] =
    await Promise.all([
      getApplicants(),
      selectAllRows<AssignmentRow>("assignments", "applicant_id, grader_id, slot"),
      selectAllRows<ScoreRow>(
        "written_scores",
        "applicant_id, grader_id, q1_score, q2_score, q3_score, q4_score, q5_score",
      ),
      supabase.from("graders").select("id, name"),
      supabase.from("decisions").select("applicant_id, decision"),
    ]);

  for (const result of [assignmentsResult, scoresResult, gradersResult, decisionsResult]) {
    if (result.error) throw new Error(`Could not load deliberation data: ${result.error.message}`);
  }

  const graderNames = new Map((gradersResult.data ?? []).map((grader) => [grader.id, grader.name]));
  const decisions = new Map(
    (decisionsResult.data ?? []).map((item) => [item.applicant_id, item.decision as Decision]),
  );

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
    (scoresResult.data ?? []).map((score) => [`${score.applicant_id}:${score.grader_id}`, score]),
  );

  return applicants.map((applicant) => {
    const slots = [...(slotsByApplicant.get(applicant.id) ?? [])].sort(
      (left, right) => left.slot - right.slot,
    );

    const graders: GraderSubmission[] = slots.map((assignment) => {
      const score = scoresByAssignment.get(`${applicant.id}:${assignment.grader_id}`);
      const values = score ? scoreValues(score) : [];
      return {
        slot: assignment.slot,
        graderId: assignment.grader_id,
        graderName: graderNames.get(assignment.grader_id) ?? "Unknown grader",
        submitted: Boolean(score),
        values,
        overall: average(values),
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
      id: applicant.id,
      name: applicant.name,
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
      decision: decisions.get(applicant.id) ?? null,
    };
  });
}
