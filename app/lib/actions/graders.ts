"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import {
  assertActiveSetUnchanged,
  requireActiveApplicantSet,
} from "@/lib/applicant-sets";
import { supabase } from "@/lib/supabase";

export type Grader = {
  id: string;
  name: string;
  is_active: boolean;
};

export async function listGraders(setId?: string): Promise<Grader[]> {
  const activeSet = setId ? null : await requireActiveApplicantSet();
  const { data, error } = await supabase
    .from("applicant_set_graders")
    .select("grader_id, is_active, graders!inner(id, name)")
    .eq("set_id", setId ?? activeSet!.id);

  if (error) throw new Error(`Could not load graders: ${error.message}`);
  return (data ?? [])
    .map((row) => ({
      id: (row.graders as unknown as { id: string; name: string }).id,
      name: (row.graders as unknown as { id: string; name: string }).name,
      is_active: row.is_active,
    }))
    .sort((left, right) => left.name.localeCompare(right.name));
}

export async function addGrader(name: string): Promise<Grader> {
  const set = await requireActiveApplicantSet();
  return addGraderToSet(name, set.id);
}

/** Adds a grader from an admin page after confirming its applicant set is current. */
export async function addGraderForSet(name: string, expectedSetId: string): Promise<Grader> {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);
  return addGraderToSet(name, set.id);
}

async function addGraderToSet(name: string, setId: string): Promise<Grader> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A grader needs a name.");

  const { data, error } = await supabase
    .rpc("add_grader_to_set", {
      target_set_id: setId,
      target_name: trimmed,
    })
    .single<Grader>();

  if (error || !data) {
    throw new Error(`Could not add grader: ${error?.message ?? "unknown error"}`);
  }

  revalidatePath("/", "layout");
  return data;
}

/** Graders are never deleted, since scores and assignments reference them. */
export async function setGraderActive(id: string, isActive: boolean, expectedSetId: string) {
  await requireAdmin();
  const set = await assertActiveSetUnchanged(expectedSetId);
  const { error } = await supabase
    .from("applicant_set_graders")
    .update({ is_active: isActive })
    .eq("set_id", set.id)
    .eq("grader_id", id);

  if (error) throw new Error(`Could not update grader: ${error.message}`);
  revalidatePath("/", "layout");
}
