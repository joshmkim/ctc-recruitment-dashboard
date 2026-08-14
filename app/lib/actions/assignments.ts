"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import { ASSIGNMENT_SLOTS, GRADERS_PER_APPLICANT } from "@/lib/grading";
import { selectAllRows, selectRowsIn, supabase } from "@/lib/supabase";

export type Assignment = {
  applicant_id: string;
  grader_id: string;
};

/** Every assignment. Only the admin views show every applicant's graders, so
 *  this is the admin read; a grader's own page uses the two below. */
export async function listAssignments(): Promise<Assignment[]> {
  const { data, error } = await selectAllRows<Assignment>(
    "assignments",
    "applicant_id, grader_id",
  );

  if (error) throw new Error(`Could not load assignments: ${error.message}`);
  return data ?? [];
}

/** Just one grader's assignments, for screens that only build their own queue. */
export async function listMyAssignments(
  graderId: string,
): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("applicant_id, grader_id")
    .eq("grader_id", graderId);

  if (error) throw new Error(`Could not load assignments: ${error.message}`);
  return data ?? [];
}

/** Both graders on each of the given applicants. A grader's queue shows who
 *  else is reading the same application, which their own rows do not say. */
export async function listAssignmentsForApplicants(
  applicantIds: string[],
): Promise<Assignment[]> {
  const { data, error } = await selectRowsIn<Assignment>(
    "assignments",
    "applicant_id, grader_id",
    "applicant_id",
    applicantIds,
  );

  if (error) throw new Error(`Could not load assignments: ${error.message}`);
  return data ?? [];
}

export async function assignGrader(applicantId: string, graderId: string) {
  await requireAdmin();

  const { data: existing, error: readError } = await supabase
    .from("assignments")
    .select("grader_id, slot")
    .eq("applicant_id", applicantId);
  if (readError) throw new Error(`Could not assign grader: ${readError.message}`);

  const rows = existing ?? [];

  // Assigning someone who is already assigned is a no-op, not an error.
  if (rows.some((row) => row.grader_id === graderId)) {
    revalidatePath("/", "layout");
    return;
  }

  const taken = new Set(rows.map((row) => row.slot));
  const slot = ASSIGNMENT_SLOTS.find((candidate) => !taken.has(candidate));
  if (slot === undefined) {
    throw new Error(
      `This applicant already has ${GRADERS_PER_APPLICANT} graders. Unassign one before adding another.`,
    );
  }

  const { error } = await supabase
    .from("assignments")
    .insert({ applicant_id: applicantId, grader_id: graderId, slot });

  // The read above and this insert are not one transaction, so a second admin
  // can claim the slot in between. The unique index refuses the write rather
  // than letting a third grader through, which leaves nothing to repair.
  if (error?.code === "23505") {
    throw new Error(
      "Another admin just changed this applicant's graders. Reload and try again.",
    );
  }
  if (error) throw new Error(`Could not assign grader: ${error.message}`);

  revalidatePath("/", "layout");
}

export async function unassignGrader(applicantId: string, graderId: string) {
  await requireAdmin();

  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("applicant_id", applicantId)
    .eq("grader_id", graderId);

  if (error) throw new Error(`Could not remove assignment: ${error.message}`);
  revalidatePath("/", "layout");
}
