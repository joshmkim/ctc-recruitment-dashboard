"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import { autoAssign } from "@/lib/actions/admin";
import {
  activateApplicantSet,
  anonymizeApplicantSet,
  createGraderRoster,
  importApplicants,
  type ImportResult,
} from "@/lib/actions/import";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";
import { SEED_GRADERS } from "@/lib/seed/graders";
import { supabase } from "@/lib/supabase";

// Not exported: a `"use server"` module may only export async functions, and a
// single non-function export silently strips every export in the file.
const SEED_CSV = "seed/seed_applicants.csv";

/**
 * Seeding is refused outside development.
 *
 * This is the only guard that exists, and it is worth being clear about what it
 * does and does not cover. It stops the deployed app from ever offering or
 * accepting a seed. It does not stop a local dev server from seeding whatever
 * database `SUPABASE_URL` points at — if that is the real project, this will
 * happily add forty fictional graders to it. Point it at a scratch project.
 */
function seedingAllowed() {
  return process.env.NODE_ENV !== "production";
}

function fakeScore(key: string, question: number) {
  let hash = question + 1;
  for (const character of key) {
    hash = (hash * 31 + character.charCodeAt(0)) >>> 0;
  }
  return (hash % 4) + 1;
}

/**
 * Builds a complete test version through the same staged import actions as a
 * real CSV: import, anonymize, create its grader roster, then activate it.
 *
 * Grader names remain globally reusable, but their active membership is added
 * only to this new applicant set.
 */
export async function seedTestData(): Promise<ImportResult> {
  await requireAdmin();
  if (!seedingAllowed()) {
    return { ok: false, message: "Seeding is disabled outside development." };
  }

  let csv: string;
  try {
    csv = await readFile(path.join(process.cwd(), SEED_CSV), "utf8");
  } catch {
    return {
      ok: false,
      message: `Could not read ${SEED_CSV}. Generate it with \`node scripts/generate-seed.mjs\`.`,
    };
  }

  const imported = await importApplicants("seeded_version", csv);
  if (!imported.ok) return imported;

  const anonymized = await anonymizeApplicantSet(imported.setId);
  if (!anonymized.ok) return anonymized;

  const roster = await createGraderRoster(imported.setId, [...SEED_GRADERS]);
  if (!roster.ok) return roster;

  const activated = await activateApplicantSet(imported.setId);
  if (!activated.ok) return activated;

  return imported;
}

/** Assigns every applicant in the active seeded version and submits stable,
 * varied fake scores for both graders so the deliberation view is complete. */
export async function seedGrades() {
  await requireAdmin();
  if (!seedingAllowed()) {
    return { ok: false as const, message: "Seeding is disabled outside development." };
  }

  const set = await requireActiveApplicantSet();
  if (set.name !== "seeded_version") {
    return {
      ok: false as const,
      message: "Fake grades can only be added while seeded_version is active.",
    };
  }

  const assignmentResult = await autoAssign(set.id);
  if (assignmentResult.shortfall) {
    return {
      ok: false as const,
      message: `${assignmentResult.shortfall} grading slots could not be assigned.`,
    };
  }

  const { data: assignments, error: assignmentError } = await supabase
    .from("assignments")
    .select("applicant_id, grader_id")
    .eq("set_id", set.id);
  if (assignmentError) {
    return {
      ok: false as const,
      message: `Could not load seeded assignments: ${assignmentError.message}`,
    };
  }

  const submittedAt = new Date().toISOString();
  const rows = (assignments ?? []).map((assignment) => {
    const key = `${assignment.applicant_id}:${assignment.grader_id}`;
    return {
      set_id: set.id,
      applicant_id: assignment.applicant_id,
      grader_id: assignment.grader_id,
      q1_score: fakeScore(key, 0),
      q2_score: fakeScore(key, 1),
      q3_score: fakeScore(key, 2),
      q4_score: fakeScore(key, 3),
      q5_score: fakeScore(key, 4),
      submitted_at: submittedAt,
    };
  });

  for (let from = 0; from < rows.length; from += 200) {
    const { error } = await supabase
      .from("written_scores")
      .upsert(rows.slice(from, from + 200), {
        onConflict: "set_id,applicant_id,grader_id",
      });
    if (error) {
      return { ok: false as const, message: `Could not seed grades: ${error.message}` };
    }
  }

  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");
  return { ok: true as const, scoreCount: rows.length };
}
