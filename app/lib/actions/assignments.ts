"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export type Assignment = {
  applicant_id: string;
  grader_id: string;
};

export async function listAssignments(): Promise<Assignment[]> {
  const { data, error } = await supabase
    .from("assignments")
    .select("applicant_id, grader_id");

  if (error) throw new Error(`Could not load assignments: ${error.message}`);
  return data ?? [];
}

export async function assignGrader(applicantId: string, graderId: string) {
  await requireAdmin();

  const { error } = await supabase
    .from("assignments")
    .insert({ applicant_id: applicantId, grader_id: graderId });

  // Assigning someone who is already assigned is a no-op, not an error.
  if (error && error.code !== "23505") {
    throw new Error(`Could not assign grader: ${error.message}`);
  }

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
