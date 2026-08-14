"use server";

import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import { parseApplicantCsv } from "@/lib/import/applicant-csv";
import { selectAllRows, supabase } from "@/lib/supabase";

/** Rows per upsert. The essays make each row a few kilobytes, and one statement
 *  carrying a whole cohort is a needlessly large request to have fail. */
const CHUNK = 200;

export type ImportSummary = {
  created: number;
  updated: number;
  blankRows: number;
  duplicates: Array<{ email: string; kept: string; discarded: number }>;
  /** Applicants already in the database that this CSV does not mention. Never
   *  deleted — see the note on the action below. */
  missing: string[];
  /** Of those, the ones graders have already scored. Louder, because it means the
   *  export and the scores disagree about who is being considered. */
  missingWithScores: string[];
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
export async function importApplicants(csv: string): Promise<ImportResult> {
  await requireAdmin();

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

  const [{ data: existing, error: existingError }, { data: scored, error: scoredError }] =
    await Promise.all([
      selectAllRows<{ applicant_id: string }>(
        "applicants",
        "applicant_id",
        "applicant_id",
      ),
      selectAllRows<{ applicant_id: string }>("written_scores", "applicant_id", "id"),
    ]);

  if (existingError) {
    return { ok: false, message: `Could not read current applicants: ${existingError.message}` };
  }
  if (scoredError) {
    return { ok: false, message: `Could not read submitted scores: ${scoredError.message}` };
  }

  const existingIds = new Set((existing ?? []).map((row) => row.applicant_id));
  const scoredIds = new Set((scored ?? []).map((row) => row.applicant_id));
  const importedIds = new Set(rows.map((row) => row.applicant_id));

  for (let from = 0; from < rows.length; from += CHUNK) {
    const { error } = await supabase
      .from("applicants")
      .upsert(rows.slice(from, from + CHUNK), { onConflict: "applicant_id" });

    if (error) {
      return {
        ok: false,
        message:
          `Import stopped after ${from} of ${rows.length} applicants: ${error.message}. ` +
          "Importing is repeatable, so fix the problem and run it again to land the rest.",
      };
    }
  }

  const missing = [...existingIds].filter((id) => !importedIds.has(id));

  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");

  return {
    ok: true,
    created: rows.filter((row) => !existingIds.has(row.applicant_id)).length,
    updated: rows.filter((row) => existingIds.has(row.applicant_id)).length,
    blankRows,
    duplicates,
    missing,
    missingWithScores: missing.filter((id) => scoredIds.has(id)),
    warnings,
  };
}
