"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import {
  assertActiveSetUnchanged,
  requireActiveApplicantSet,
} from "@/lib/applicant-sets";
import { ASSIGNMENT_SLOTS, GRADERS_PER_APPLICANT } from "@/lib/grading";
import { getGraderId } from "@/lib/identity";
import { selectAllRows, selectRowsIn, supabase } from "@/lib/supabase";

export type Assignment = {
  set_id: string;
  applicant_id: string;
  grader_id: string;
};

/** Every assignment. Only the admin views show every applicant's graders, so
 *  this is the admin read; a grader's own page uses the two below. */
export async function listAssignments(): Promise<Assignment[]> {
  const set = await requireActiveApplicantSet();
  const { data, error } = await selectAllRows<Assignment>(
    "assignments",
    "set_id, applicant_id, grader_id",
    "id",
    { column: "set_id", value: set.id },
  );

  if (error) throw new Error(`Could not load assignments: ${error.message}`);
  return data ?? [];
}

/** Just one grader's assignments, for screens that only build their own queue. */
export async function listMyAssignments(): Promise<Assignment[]> {
  const [set, graderId] = await Promise.all([
    requireActiveApplicantSet(),
    getGraderId(),
  ]);
  if (!graderId) return [];

  const { data, error } = await supabase
    .from("assignments")
    .select("set_id, applicant_id, grader_id")
    .eq("set_id", set.id)
    .eq("grader_id", graderId);

  if (error) throw new Error(`Could not load assignments: ${error.message}`);
  return data ?? [];
}

/** Both graders on each of the given applicants. A grader's queue shows who
 *  else is reading the same application, which their own rows do not say. */
export async function listAssignmentsForApplicants(
  applicantIds: string[],
): Promise<Assignment[]> {
  const set = await requireActiveApplicantSet();
  const { data, error } = await selectRowsIn<Assignment>(
    "assignments",
    "set_id, applicant_id, grader_id",
    "applicant_id",
    applicantIds,
    { column: "set_id", value: set.id },
  );

  if (error) throw new Error(`Could not load assignments: ${error.message}`);
  return data ?? [];
}

export async function assignGrader(
  applicantId: string,
  graderId: string,
  expectedSetId: string,
) {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);

  const { data: membership, error: membershipError } = await supabase
    .from("applicant_set_graders")
    .select("is_active")
    .eq("set_id", set.id)
    .eq("grader_id", graderId)
    .maybeSingle();
  if (membershipError) throw new Error(`Could not verify grader roster: ${membershipError.message}`);
  if (!membership?.is_active) {
    throw new Error("That grader is not active in this applicant set.");
  }

  const { data: existing, error: readError } = await supabase
    .from("assignments")
    .select("grader_id, slot")
    .eq("set_id", set.id)
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
    .insert({ set_id: set.id, applicant_id: applicantId, grader_id: graderId, slot });

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

async function assertAssignmentIsUnscored(
  setId: string,
  applicantId: string,
  graderId: string,
) {
  const { data, error } = await supabase
    .from("written_scores")
    .select("id")
    .eq("set_id", setId)
    .eq("applicant_id", applicantId)
    .eq("grader_id", graderId)
    .maybeSingle();

  if (error) throw new Error(`Could not verify submitted scores: ${error.message}`);
  if (data) {
    throw new Error(
      "This grader has already submitted a score, so their assignment cannot be changed.",
    );
  }
}

export async function reassignGrader(
  applicantId: string,
  fromGraderId: string,
  toGraderId: string,
  expectedSetId: string,
) {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);
  if (fromGraderId === toGraderId) return;

  const { data: membership, error: membershipError } = await supabase
    .from("applicant_set_graders")
    .select("is_active")
    .eq("set_id", set.id)
    .eq("grader_id", toGraderId)
    .maybeSingle();
  if (membershipError) throw new Error(`Could not verify grader roster: ${membershipError.message}`);
  if (!membership?.is_active) {
    throw new Error("That grader is not active in this applicant set.");
  }

  await assertAssignmentIsUnscored(set.id, applicantId, fromGraderId);

  const { data, error } = await supabase
    .from("assignments")
    .update({ grader_id: toGraderId })
    .eq("set_id", set.id)
    .eq("applicant_id", applicantId)
    .eq("grader_id", fromGraderId)
    .select("slot");

  if (error?.code === "23505") {
    throw new Error(
      "Another admin just changed this applicant's graders. Reload and try again.",
    );
  }
  if (error) throw new Error(`Could not switch grader: ${error.message}`);
  if (!data?.length) {
    throw new Error("That assignment no longer exists. Reload and try again.");
  }

  revalidatePath("/", "layout");
}

export async function unassignGrader(
  applicantId: string,
  graderId: string,
  expectedSetId: string,
) {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);

  await assertAssignmentIsUnscored(set.id, applicantId, graderId);

  const { error } = await supabase
    .from("assignments")
    .delete()
    .eq("set_id", set.id)
    .eq("applicant_id", applicantId)
    .eq("grader_id", graderId);

  if (error) throw new Error(`Could not remove assignment: ${error.message}`);
  revalidatePath("/", "layout");
}
