"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import { getApplicants } from "@/lib/applications";
import { supabase } from "@/lib/supabase";
import { addGrader } from "@/lib/actions/graders";

type AssignmentRow = { applicant_id: string; grader_id: string };
type GraderRow = { id: string; name: string; is_active: boolean };

function refreshAdmin() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}

async function loadAssignmentState() {
  const [{ data: graders, error: graderError }, { data: assignments, error: assignmentError }] =
    await Promise.all([
      supabase.from("graders").select("id, name, is_active").order("name"),
      supabase.from("assignments").select("applicant_id, grader_id"),
    ]);

  if (graderError) throw new Error(`Could not load graders: ${graderError.message}`);
  if (assignmentError) throw new Error(`Could not load assignments: ${assignmentError.message}`);

  return {
    graders: (graders ?? []) as GraderRow[],
    assignments: (assignments ?? []) as AssignmentRow[],
  };
}

function leastLoadedEligible(
  graders: GraderRow[],
  assignments: AssignmentRow[],
  applicantId: string,
  allowedIds?: Set<string>,
) {
  const assigned = new Set(
    assignments
      .filter((assignment) => assignment.applicant_id === applicantId)
      .map((assignment) => assignment.grader_id),
  );
  const load = new Map<string, number>();

  for (const grader of graders) {
    load.set(
      grader.id,
      assignments.filter((assignment) => assignment.grader_id === grader.id).length,
    );
  }

  return graders
    .filter(
      (grader) =>
        grader.is_active &&
        !assigned.has(grader.id) &&
        (!allowedIds || allowedIds.has(grader.id)),
    )
    .sort(
      (left, right) =>
        (load.get(left.id) ?? 0) - (load.get(right.id) ?? 0) ||
        left.name.localeCompare(right.name),
    )[0];
}

export async function autoAssign(gradersPerApplicant: number) {
  await requireAdmin();

  if (!Number.isInteger(gradersPerApplicant) || gradersPerApplicant < 1 || gradersPerApplicant > 20) {
    throw new Error("Choose between 1 and 20 graders per applicant.");
  }

  const [applicants, { graders, assignments }] = await Promise.all([
    getApplicants(),
    loadAssignmentState(),
  ]);
  const activeCount = graders.filter((grader) => grader.is_active).length;
  if (!activeCount) throw new Error("Add or reactivate at least one grader first.");

  const inserts: AssignmentRow[] = [];
  const current = [...assignments];
  let shortfall = 0;

  for (const applicant of applicants) {
    while (
      current.filter((assignment) => assignment.applicant_id === applicant.id).length <
      gradersPerApplicant
    ) {
      const target = leastLoadedEligible(graders, current, applicant.id);
      if (!target) {
        shortfall += 1;
        break;
      }
      const assignment = { applicant_id: applicant.id, grader_id: target.id };
      inserts.push(assignment);
      current.push(assignment);
    }
  }

  if (inserts.length) {
    const { error } = await supabase.from("assignments").insert(inserts);
    if (error) throw new Error(`Could not assign graders: ${error.message}`);
  }

  refreshAdmin();
  return {
    assigned: inserts.length,
    shortfall,
    activeGraders: activeCount,
  };
}

export async function addGraderAsAdmin(name: string) {
  await requireAdmin();
  return addGrader(name);
}

export async function deactivateAndRedistribute(
  graderId: string,
  targetGraderIds: string[],
) {
  await requireAdmin();

  const [{ graders, assignments }, { data: submitted, error: scoreError }] = await Promise.all([
    loadAssignmentState(),
    supabase.from("written_scores").select("applicant_id, grader_id"),
  ]);
  if (scoreError) throw new Error(`Could not load submitted scores: ${scoreError.message}`);

  const grader = graders.find((item) => item.id === graderId);
  if (!grader) throw new Error("That grader no longer exists.");

  const targetIds = new Set(targetGraderIds.filter((id) => id !== graderId));
  const validTargets = graders.filter(
    (item) => item.is_active && item.id !== graderId && targetIds.has(item.id),
  );
  if (!validTargets.length) throw new Error("Select at least one active grader to redistribute work.");

  const submittedKeys = new Set(
    (submitted ?? []).map((score) => `${score.applicant_id}:${score.grader_id}`),
  );
  const ungraded = assignments.filter(
    (assignment) =>
      assignment.grader_id === graderId &&
      !submittedKeys.has(`${assignment.applicant_id}:${graderId}`),
  );
  const current = assignments.filter((assignment) => assignment.grader_id !== graderId);
  const inserts: AssignmentRow[] = [];

  for (const assignment of ungraded) {
    const target = leastLoadedEligible(
      graders.map((item) => ({
        ...item,
        is_active: validTargets.some((valid) => valid.id === item.id),
      })),
      current,
      assignment.applicant_id,
      new Set(validTargets.map((item) => item.id)),
    );
    if (!target) continue;
    const replacement = { applicant_id: assignment.applicant_id, grader_id: target.id };
    inserts.push(replacement);
    current.push(replacement);
  }

  const { error: deactivateError } = await supabase
    .from("graders")
    .update({ is_active: false })
    .eq("id", graderId);
  if (deactivateError) throw new Error(`Could not deactivate grader: ${deactivateError.message}`);

  if (ungraded.length) {
    const { error: deleteError } = await supabase
      .from("assignments")
      .delete()
      .eq("grader_id", graderId)
      .in(
        "applicant_id",
        ungraded.map((assignment) => assignment.applicant_id),
      );
    if (deleteError) throw new Error(`Could not remove old assignments: ${deleteError.message}`);
  }

  if (inserts.length) {
    const { error: insertError } = await supabase.from("assignments").insert(inserts);
    if (insertError) throw new Error(`Could not redistribute assignments: ${insertError.message}`);
  }

  refreshAdmin();
  return {
    moved: inserts.length,
    notMoved: ungraded.length - inserts.length,
    preservedSubmitted: assignments.length - ungraded.length,
  };
}

export async function reactivateGrader(graderId: string) {
  await requireAdmin();
  const { error } = await supabase
    .from("graders")
    .update({ is_active: true })
    .eq("id", graderId);
  if (error) throw new Error(`Could not reactivate grader: ${error.message}`);
  refreshAdmin();
}

export type Decision = "admit" | "lean_admit" | "lean_deny" | "deny";

export async function setDecision(applicantId: string, decision: Decision) {
  await requireAdmin();
  if (!["admit", "lean_admit", "lean_deny", "deny"].includes(decision)) {
    throw new Error("Invalid decision.");
  }

  const { error } = await supabase.from("decisions").upsert(
    { applicant_id: applicantId, decision, decided_at: new Date().toISOString() },
    { onConflict: "applicant_id" },
  );
  if (error) throw new Error(`Could not save decision: ${error.message}`);
  refreshAdmin();
}

export async function clearDecision(applicantId: string) {
  await requireAdmin();

  const { error } = await supabase
    .from("decisions")
    .delete()
    .eq("applicant_id", applicantId);
  if (error) throw new Error(`Could not clear decision: ${error.message}`);
  refreshAdmin();
}
