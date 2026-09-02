"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import {
  assertActiveSetUnchanged,
} from "@/lib/applicant-sets";
import { getApplicants } from "@/lib/applications";
import {
  ASSIGNMENT_SLOTS,
  GRADERS_PER_APPLICANT,
  type AssignmentSlot,
} from "@/lib/grading";
import { selectAllRows, supabase } from "@/lib/supabase";
import { addGraderForSet, listGraders } from "@/lib/actions/graders";

type AssignmentRow = {
  set_id: string;
  applicant_id: string;
  grader_id: string;
  slot: AssignmentSlot;
};
type GraderRow = { id: string; name: string; is_active: boolean };

function refreshAdmin() {
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
}

async function loadAssignmentState(setId: string) {
  // Assignment balancing counts each grader's existing load, so a partial read
  // would pile new work onto graders who already have plenty.
  const [graders, { data: assignments, error: assignmentError }] =
    await Promise.all([
      listGraders(setId),
      selectAllRows<AssignmentRow>(
        "assignments",
        "set_id, applicant_id, grader_id, slot",
        "id",
        { column: "set_id", value: setId },
      ),
    ]);

  if (assignmentError) throw new Error(`Could not load assignments: ${assignmentError.message}`);

  return {
    graders,
    assignments: assignments ?? [],
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

/** Fills whichever of the two slots each applicant is missing, without touching
 *  existing rows. Pure, so the preview and the write agree on what would happen. */
function planAssignments(
  applicants: Array<{ id: string }>,
  graders: GraderRow[],
  assignments: AssignmentRow[],
) {
  const inserts: AssignmentRow[] = [];
  const current = [...assignments];
  let shortfall = 0;

  for (const applicant of applicants) {
    const filled = new Set(
      current
        .filter((assignment) => assignment.applicant_id === applicant.id)
        .map((assignment) => assignment.slot),
    );

    for (const slot of ASSIGNMENT_SLOTS) {
      if (filled.has(slot)) continue;

      const target = leastLoadedEligible(graders, current, applicant.id);
      if (!target) {
        // Eligibility only excludes graders already on this applicant, so
        // finding nobody for one slot means nobody for the rest either.
        shortfall += GRADERS_PER_APPLICANT - filled.size;
        break;
      }

      const assignment = { set_id: "", applicant_id: applicant.id, grader_id: target.id, slot };
      inserts.push(assignment);
      current.push(assignment);
      filled.add(slot);
    }
  }

  return { inserts, shortfall };
}

/**
 * Inserts assignments, skipping any that already exist.
 *
 * A plain `insert` of several rows is one statement, so a single duplicate key
 * aborts the whole batch and writes nothing — which is what happened when two
 * admins assigned at once. Returns the rows actually created, since
 * `on conflict do nothing` only returns those.
 *
 * The conflict target has to be named. Left out, PostgREST arbitrates on the
 * primary key, which is a generated uuid that never collides, so nothing would
 * be skipped. `(applicant_id, slot)` is the collision two admins running this at
 * once produce: they plan the same empty slots from the same starting state.
 *
 * A conflict on `(applicant_id, grader_id)` instead — the same grader landing in
 * a different slot — is not skipped and still aborts the batch. It needs one
 * admin's write to land between another's read and write, so it is reported
 * rather than handled; assignment is idempotent, so retrying settles it.
 */
async function insertNewAssignments(setId: string, inserts: AssignmentRow[]) {
  const { data, error } = await supabase
    .from("assignments")
    .upsert(inserts.map((insert) => ({ ...insert, set_id: setId })), {
      onConflict: "set_id,applicant_id,slot",
      ignoreDuplicates: true,
    })
    .select("applicant_id");

  if (error?.code === "23505") {
    throw new Error(
      "Another admin was assigning at the same time. Nothing was written — reload and try again.",
    );
  }

  return { created: data?.length ?? 0, error };
}

export type AutoAssignPreview = {
  toCreate: number;
  shortfall: number;
  activeGraders: number;
  gradersAffected: number;
  submittedScores: number;
  gradersStarted: number;
};

/** What `autoAssign` would do, so the confirmation can show it before writing. */
export async function previewAutoAssign(expectedSetId: string): Promise<AutoAssignPreview> {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);

  const [applicants, { graders, assignments }, { data: submitted, error }] = await Promise.all([
    getApplicants(set.id),
    loadAssignmentState(set.id),
    selectAllRows<{ set_id: string; applicant_id: string; grader_id: string }>(
      "written_scores",
      "set_id, applicant_id, grader_id",
      "id",
      { column: "set_id", value: set.id },
    ),
  ]);
  if (error) throw new Error(`Could not load submitted scores: ${error.message}`);

  const { inserts, shortfall } = planAssignments(applicants, graders, assignments);

  return {
    toCreate: inserts.length,
    shortfall,
    activeGraders: graders.filter((grader) => grader.is_active).length,
    gradersAffected: new Set(inserts.map((assignment) => assignment.grader_id)).size,
    submittedScores: (submitted ?? []).length,
    gradersStarted: new Set((submitted ?? []).map((score) => score.grader_id)).size,
  };
}

export async function autoAssign(expectedSetId: string) {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);

  const [applicants, { graders, assignments }] = await Promise.all([
    getApplicants(set.id),
    loadAssignmentState(set.id),
  ]);
  const activeCount = graders.filter((grader) => grader.is_active).length;
  if (activeCount < GRADERS_PER_APPLICANT) {
    throw new Error(
      `Every applicant needs ${GRADERS_PER_APPLICANT} different graders, so at least ${GRADERS_PER_APPLICANT} must be active.`,
    );
  }

  const { inserts, shortfall } = planAssignments(applicants, graders, assignments);

  let assigned = 0;
  if (inserts.length) {
    const { created, error } = await insertNewAssignments(set.id, inserts);
    if (error) throw new Error(`Could not assign graders: ${error.message}`);
    assigned = created;
  }

  refreshAdmin();
  return {
    assigned,
    // Non-zero when a concurrent admin, or a second click, got there first.
    skipped: inserts.length - assigned,
    shortfall,
    activeGraders: activeCount,
  };
}

export async function addGraderAsAdmin(name: string, expectedSetId: string) {
  await requireAdmin();
  return addGraderForSet(name, expectedSetId);
}

export async function deactivateAndRedistribute(
  graderId: string,
  targetGraderIds: string[],
  expectedSetId: string,
) {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);

  // A missed score row here would look like unfinished work and get reassigned,
  // so this read has to cover every submission.
  const [{ graders, assignments }, { data: submitted, error: scoreError }] = await Promise.all([
    loadAssignmentState(set.id),
    selectAllRows<{ set_id: string; applicant_id: string; grader_id: string }>(
      "written_scores",
      "set_id, applicant_id, grader_id",
      "id",
      { column: "set_id", value: set.id },
    ),
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
    // The outgoing row is deleted below, so the replacement inherits its slot
    // and the applicant keeps both graders. When there is no eligible target the
    // slot is left empty, which the deliberation view reports as understaffed.
    if (!target) continue;
    const replacement = {
      set_id: set.id,
      applicant_id: assignment.applicant_id,
      grader_id: target.id,
      slot: assignment.slot,
    };
    inserts.push(replacement);
    current.push(replacement);
  }

  const { error: deactivateError } = await supabase
    .from("applicant_set_graders")
    .update({ is_active: false })
    .eq("set_id", set.id)
    .eq("grader_id", graderId);
  if (deactivateError) throw new Error(`Could not deactivate grader: ${deactivateError.message}`);

  if (ungraded.length) {
    const { error: deleteError } = await supabase
      .from("assignments")
      .delete()
      .eq("set_id", set.id)
      .eq("grader_id", graderId)
      .in(
        "applicant_id",
        ungraded.map((assignment) => assignment.applicant_id),
      );
    if (deleteError) throw new Error(`Could not remove old assignments: ${deleteError.message}`);
  }

  let moved = 0;
  if (inserts.length) {
    const { created, error: insertError } = await insertNewAssignments(set.id, inserts);
    if (insertError) throw new Error(`Could not redistribute assignments: ${insertError.message}`);
    moved = created;
  }

  refreshAdmin();
  return {
    moved,
    notMoved: ungraded.length - moved,
  };
}

export async function reactivateGrader(graderId: string, expectedSetId: string) {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);
  const { error } = await supabase
    .from("applicant_set_graders")
    .update({ is_active: true })
    .eq("set_id", set.id)
    .eq("grader_id", graderId);
  if (error) throw new Error(`Could not reactivate grader: ${error.message}`);
  refreshAdmin();
}

export type Decision = "admit" | "lean_admit" | "lean_deny" | "deny";

export async function setDecision(
  applicantId: string,
  decision: Decision,
  expectedSetId: string,
) {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);
  if (!["admit", "lean_admit", "lean_deny", "deny"].includes(decision)) {
    throw new Error("Invalid decision.");
  }

  const { error } = await supabase.from("decisions").upsert(
    { set_id: set.id, applicant_id: applicantId, decision, decided_at: new Date().toISOString() },
    { onConflict: "set_id,applicant_id" },
  );
  if (error) throw new Error(`Could not save decision: ${error.message}`);
  refreshAdmin();
}

export async function clearDecision(applicantId: string, expectedSetId: string) {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);

  const { error } = await supabase
    .from("decisions")
    .delete()
    .eq("set_id", set.id)
    .eq("applicant_id", applicantId);
  if (error) throw new Error(`Could not clear decision: ${error.message}`);
  refreshAdmin();
}
