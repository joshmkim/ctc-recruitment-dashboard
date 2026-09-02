"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import { assignMissingAliases } from "@/lib/applications";
import { parseApplicantCsv } from "@/lib/import/applicant-csv";
import { supabase } from "@/lib/supabase";

/** Rows per upsert. The essays make each row a few kilobytes, and one statement
 *  carrying a whole cohort is a needlessly large request to have fail. */
const CHUNK = 200;

export type ImportSummary = {
  setId: string;
  applicantCount: number;
  blankRows: number;
  duplicates: Array<{ email: string; kept: string; discarded: number }>;
  warnings: string[];
};

/**
 * Failures come back as data rather than as exceptions.
 *
 * Next.js replaces the message of anything thrown from a server action with a
 * generic string in production. For most actions that is fine. Here the message
 * is the feature — "no column starts with 'community is a core pillar'" is the
 * difference between a two-minute fix and an afternoon — so anything a person
 * can act on is returned instead of thrown.
 */
export type ImportResult =
  | ({ ok: true } & ImportSummary)
  | { ok: false; message: string };

/**
 * Replaces the applicant pool from a Google Sheets CSV export.
 *
 * Upsert-only, by design. If an applicant is in the database but not in the CSV,
 * the likeliest explanations are a filtered sheet, a partial export, or a
 * deleted row — not a withdrawn application. Deleting on that guess would strip
 * the essays out from under any scores already submitted against them, so the
 * mismatch is reported for a human to resolve instead.
 *
 * Safe to run repeatedly, which is the point: late submissions are a re-import
 * rather than an incident. That also covers a chunk failing halfway, since
 * running it again settles the rest.
 */
export async function importApplicants(name: string, csv: string): Promise<ImportResult> {
  await requireAdmin();

  const setName = name.trim();
  if (!setName) return { ok: false, message: "Give this applicant set a name." };
  if (!csv.trim()) return { ok: false, message: "That file is empty." };

  // Rejects a column that cannot be matched or a timestamp that cannot be read,
  // before anything is written.
  let parsed;
  try {
    parsed = parseApplicantCsv(csv);
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Could not read that CSV.",
    };
  }

  const { rows, blankRows, duplicates, warnings } = parsed;
  if (!rows.length) {
    return {
      ok: false,
      message:
        "No applicants found in that file. It parsed, but every row was missing an email address.",
    };
  }

  const { data: set, error: setError } = await supabase
    .from("applicant_sets")
    .insert({ name: setName, status: "draft" })
    .select("id")
    .single();
  if (setError || !set) {
    return { ok: false, message: `Could not create applicant set: ${setError?.message ?? "unknown error"}` };
  }

  for (let from = 0; from < rows.length; from += CHUNK) {
    const { error } = await supabase
      .from("applicants")
      .insert(rows.slice(from, from + CHUNK).map((row) => ({ ...row, set_id: set.id })));

    if (error) {
      await supabase.rpc("discard_applicant_set", { target_set_id: set.id });
      return {
        ok: false,
        message: `Could not stage the CSV: ${error.message}`,
      };
    }
  }

  revalidatePath("/admin", "layout");

  return {
    ok: true,
    setId: set.id,
    applicantCount: rows.length,
    blankRows,
    duplicates,
    warnings,
  };
}

/**
 * Hands a unique AAA–ZZZ code to every applicant who does not have one yet.
 *
 * Called after every import so new rows from the CSV — which still carry real
 * names — are anonymised without a separate step. Existing aliases are left
 * alone, including on re-import.
 */
export async function anonymizeApplicantSet(setId: string): Promise<ImportResult> {
  await requireAdmin();
  const { data: set, error: setError } = await supabase
    .from("applicant_sets").select("status").eq("id", setId).maybeSingle();
  if (setError || !set) return { ok: false, message: "Applicant set was not found." };
  if (set.status !== "draft") return { ok: false, message: "Only a draft applicant set can be anonymized." };
  const aliasError = await assignMissingAliases(setId);
  if (aliasError) return { ok: false, message: `Could not anonymize applicants: ${aliasError}` };
  const { error } = await supabase.from("applicant_sets").update({ status: "anonymized" }).eq("id", setId);
  if (error) return { ok: false, message: `Could not update applicant set: ${error.message}` };
  return importSummary(setId);
}

export async function activateApplicantSet(setId: string): Promise<ImportResult> {
  await requireAdmin();
  const { count, error: rosterError } = await supabase
    .from("applicant_set_graders")
    .select("*", { count: "exact", head: true })
    .eq("set_id", setId)
    .eq("is_active", true);
  if (rosterError || (count ?? 0) < 2) {
    return { ok: false, message: "Choose at least two active graders before making this set active." };
  }
  const { error } = await supabase.rpc("activate_applicant_set", { target_set_id: setId });
  if (error) return { ok: false, message: error.message };
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  return importSummary(setId);
}

export async function carryOverGraders(setId: string): Promise<ImportResult> {
  await requireAdmin();
  const { data: target, error: targetError } = await supabase
    .from("applicant_sets").select("status").eq("id", setId).maybeSingle();
  if (targetError || target?.status !== "anonymized") {
    return { ok: false, message: "Only an anonymized draft can receive a grader roster." };
  }
  const { data: active, error: activeError } = await supabase
    .from("applicant_sets").select("id").eq("status", "active").maybeSingle();
  if (activeError || !active) return { ok: false, message: "No active grader roster is available to copy." };
  const { data: roster, error: rosterError } = await supabase
    .from("applicant_set_graders").select("grader_id, is_active").eq("set_id", active.id);
  if (rosterError) return { ok: false, message: rosterError.message };
  const { error } = await supabase.from("applicant_set_graders").upsert(
    (roster ?? []).map((grader) => ({ set_id: setId, grader_id: grader.grader_id, is_active: grader.is_active })),
    { onConflict: "set_id,grader_id" },
  );
  if (error) return { ok: false, message: error.message };
  return importSummary(setId);
}

export async function createGraderRoster(setId: string, names: string[]): Promise<ImportResult> {
  await requireAdmin();
  const { data: target, error: targetError } = await supabase
    .from("applicant_sets").select("status").eq("id", setId).maybeSingle();
  if (targetError || target?.status !== "anonymized") {
    return { ok: false, message: "Only an anonymized draft can receive a grader roster." };
  }
  const uniqueNames = [...new Set(names.map((name) => name.trim()).filter(Boolean))];
  if (uniqueNames.length < 2) return { ok: false, message: "Add at least two grader names." };
  const { data: created, error } = await supabase
    .from("graders")
    .upsert(uniqueNames.map((name) => ({ name })), { onConflict: "name" })
    .select("id");
  if (error) return { ok: false, message: `Could not create grader roster: ${error.message}` };
  const { error: memberError } = await supabase.from("applicant_set_graders").upsert(
    (created ?? []).map((grader) => ({ set_id: setId, grader_id: grader.id, is_active: true })),
    { onConflict: "set_id,grader_id" },
  );
  if (memberError) return { ok: false, message: memberError.message };
  return importSummary(setId);
}

export async function discardApplicantSet(setId: string): Promise<ImportResult> {
  await requireAdmin();
  const { error } = await supabase.rpc("discard_applicant_set", { target_set_id: setId });
  if (error) return { ok: false, message: `Could not discard applicant set: ${error.message}` };
  revalidatePath("/admin", "layout");
  return { ok: true, setId, applicantCount: 0, blankRows: 0, duplicates: [], warnings: [] };
}

async function importSummary(setId: string): Promise<ImportResult> {
  const { count, error } = await supabase.from("applicants").select("*", { count: "exact", head: true }).eq("set_id", setId);
  if (error) return { ok: false, message: error.message };
  return { ok: true, setId, applicantCount: count ?? 0, blankRows: 0, duplicates: [], warnings: [] };
}
