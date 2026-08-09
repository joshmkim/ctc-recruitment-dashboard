"use server";

import { requireAdmin } from "@/lib/admin-auth";
import { getApplicants } from "@/lib/applications";
import type { Decision } from "@/lib/actions/admin";
import { supabase } from "@/lib/supabase";

type ScoreRow = {
  applicant_id: string;
  grader_id: string;
  q1_score: number;
  q2_score: number;
  q3_score: number;
  q4_score: number;
  q5_score: number;
};

export type DeliberationApplicant = {
  id: string;
  name: string;
  assignedCount: number;
  scoredCount: number;
  complete: boolean;
  questionAverages: number[];
  overallAverage: number;
  spread: number;
  decision: Decision | null;
  scores: Array<{
    graderId: string;
    graderName: string;
    values: number[];
    overall: number;
  }>;
  awaitingGraders: Array<{
    graderId: string;
    graderName: string;
  }>;
};

const average = (values: number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 0;

export async function getDeliberationApplicants(): Promise<DeliberationApplicant[]> {
  await requireAdmin();

  const [applicants, assignmentsResult, scoresResult, gradersResult, decisionsResult] =
    await Promise.all([
      getApplicants(),
      supabase.from("assignments").select("applicant_id, grader_id"),
      supabase
        .from("written_scores")
        .select("applicant_id, grader_id, q1_score, q2_score, q3_score, q4_score, q5_score"),
      supabase.from("graders").select("id, name"),
      supabase.from("decisions").select("applicant_id, decision"),
    ]);

  for (const result of [assignmentsResult, scoresResult, gradersResult, decisionsResult]) {
    if (result.error) throw new Error(`Could not load deliberation data: ${result.error.message}`);
  }

  const assignments = assignmentsResult.data ?? [];
  const scores = (scoresResult.data ?? []) as ScoreRow[];
  const graderNames = new Map((gradersResult.data ?? []).map((grader) => [grader.id, grader.name]));
  const decisions = new Map(
    (decisionsResult.data ?? []).map((item) => [item.applicant_id, item.decision as Decision]),
  );

  return applicants.map((applicant) => {
    const applicantAssignments = assignments.filter(
      (assignment) => assignment.applicant_id === applicant.id,
    );
    const applicantScores = scores.filter((score) => score.applicant_id === applicant.id);
    const questionAverages = [0, 1, 2, 3, 4].map((index) =>
      average(
        applicantScores.map(
          (score) => [score.q1_score, score.q2_score, score.q3_score, score.q4_score, score.q5_score][index],
        ),
      ),
    );
    const perGrader = applicantScores.map((score) => {
      const values = [
        score.q1_score,
        score.q2_score,
        score.q3_score,
        score.q4_score,
        score.q5_score,
      ];
      return {
        graderId: score.grader_id,
        graderName: graderNames.get(score.grader_id) ?? "Unknown grader",
        values,
        overall: average(values),
      };
    });
    const individualOverall = perGrader.map((score) => score.overall);
    const awaitingGraders = applicantAssignments
      .filter(
        (assignment) =>
          !applicantScores.some((score) => score.grader_id === assignment.grader_id),
      )
      .map((assignment) => ({
        graderId: assignment.grader_id,
        graderName: graderNames.get(assignment.grader_id) ?? "Unknown grader",
      }));

    return {
      id: applicant.id,
      name: applicant.name,
      assignedCount: applicantAssignments.length,
      scoredCount: applicantScores.length,
      complete:
        applicantAssignments.length > 0 &&
        applicantAssignments.every((assignment) =>
          applicantScores.some((score) => score.grader_id === assignment.grader_id),
        ),
      questionAverages,
      overallAverage: average(questionAverages),
      spread: individualOverall.length
        ? Math.max(...individualOverall) - Math.min(...individualOverall)
        : 0,
      decision: decisions.get(applicant.id) ?? null,
      scores: perGrader,
      awaitingGraders,
    };
  });
}
