"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import { supabase } from "@/lib/supabase";

export type Grader = {
  id: string;
  name: string;
  is_active: boolean;
};

export async function listGraders(): Promise<Grader[]> {
  const { data, error } = await supabase
    .from("graders")
    .select("id, name, is_active")
    .order("name");

  if (error) throw new Error(`Could not load graders: ${error.message}`);
  return data ?? [];
}

export async function addGrader(name: string): Promise<Grader> {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("A grader needs a name.");

  const { data, error } = await supabase
    .from("graders")
    .insert({ name: trimmed })
    .select("id, name, is_active")
    .single();

  if (error) {
    // 23505 is a unique violation, which here means the name already exists.
    if (error.code === "23505") {
      throw new Error(`${trimmed} is already on the grader list.`);
    }
    throw new Error(`Could not add grader: ${error.message}`);
  }

  revalidatePath("/", "layout");
  return data;
}

/** Graders are never deleted, since scores and assignments reference them. */
export async function setGraderActive(id: string, isActive: boolean) {
  await requireAdmin();
  const { error } = await supabase
    .from("graders")
    .update({ is_active: isActive })
    .eq("id", id);

  if (error) throw new Error(`Could not update grader: ${error.message}`);
  revalidatePath("/", "layout");
}
