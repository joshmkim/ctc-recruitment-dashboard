"use server";

import { revalidatePath } from "next/cache";

import { requireActiveApplicantSet } from "@/lib/applicant-sets";
import { getGraderId } from "@/lib/identity";
import { selectAllRows, selectRowsIn, supabase } from "@/lib/supabase";
import { isScoreValue, type ScoreValue } from "@/lib/scores";

export type CompleteScores = Record<
  "q1" | "q2" | "q3" | "q4" | "q5",
  ScoreValue
>;

export type SubmittedScore = {
  set_id: string;
  applicant_id: string;
  grader_id: string;
};

/** Which applicants each grader has already submitted, for the admin counts. */
export async function listSubmittedScores(): Promise<SubmittedScore[]> {
  const set = await requireActiveApplicantSet();
  const { data, error } = await selectAllRows<SubmittedScore>(
    "written_scores",
    "set_id, applicant_id, grader_id",
    "id",
    { column: "set_id", value: set.id },
  );

  if (error) throw new Error(`Could not load scores: ${error.message}`);
  return data ?? [];
}

/** The same counts, for one grader's queue rather than every applicant. */
export async function listSubmittedScoresForApplicants(
  applicantIds: string[],
): Promise<SubmittedScore[]> {
  const set = await requireActiveApplicantSet();
  const { data, error } = await selectRowsIn<SubmittedScore>(
    "written_scores",
    "set_id, applicant_id, grader_id",
    "applicant_id",
    applicantIds,
    { column: "set_id", value: set.id },
  );

  if (error) throw new Error(`Could not load scores: ${error.message}`);
  return data ?? [];
}

export async function getMyScores(
  applicantId: string,
  setId: string,
): Promise<CompleteScores | null> {
  const [activeSet, graderId] = await Promise.all([
    requireActiveApplicantSet(),
    getGraderId(),
  ]);
  if (activeSet.id !== setId) {
    throw new Error("The active applicant set changed while this page was open.");
  }
  if (!graderId) return null;

  const { data, error } = await supabase
    .from("written_scores")
    .select("q1_score, q2_score, q3_score, q4_score, q5_score")
    .eq("set_id", setId)
    .eq("applicant_id", applicantId)
    .eq("grader_id", graderId)
    .maybeSingle();

  if (error) throw new Error(`Could not load your scores: ${error.message}`);
  if (!data) return null;

  return {
    q1: data.q1_score as ScoreValue,
    q2: data.q2_score as ScoreValue,
    q3: data.q3_score as ScoreValue,
    q4: data.q4_score as ScoreValue,
    q5: data.q5_score as ScoreValue,
  };
}

export async function submitScores(
  applicantId: string,
  scores: CompleteScores,
  setId: string,
) {
  const [activeSet, graderId] = await Promise.all([
    requireActiveApplicantSet(),
    getGraderId(),
  ]);
  if (activeSet.id !== setId) {
    throw new Error(
      "The active applicant set changed while this page was open. Reload before submitting.",
    );
  }
  if (!graderId) {
    throw new Error("Pick your name before submitting scores.");
  }

  const values = Object.values(scores);
  if (values.length !== 5 || !values.every(isScoreValue)) {
    throw new Error("All five questions need a score between 1 and 4.");
  }

  const { data: assignment, error: assignmentError } = await supabase
    .from("assignments")
    .select("id")
    .eq("set_id", setId)
    .eq("applicant_id", applicantId)
    .eq("grader_id", graderId)
    .maybeSingle();
  if (assignmentError) {
    throw new Error(`Could not verify your assignment: ${assignmentError.message}`);
  }
  if (!assignment) {
    throw new Error("This application is no longer assigned to you. Reload your queue.");
  }

  const { error } = await supabase.from("written_scores").upsert(
    {
      set_id: setId,
      applicant_id: applicantId,
      grader_id: graderId,
      q1_score: scores.q1,
      q2_score: scores.q2,
      q3_score: scores.q3,
      q4_score: scores.q4,
      q5_score: scores.q5,
      submitted_at: new Date().toISOString(),
    },
    { onConflict: "set_id,applicant_id,grader_id" },
  );

  if (error) throw new Error(`Could not save your scores: ${error.message}`);
  revalidatePath("/", "layout");
}
