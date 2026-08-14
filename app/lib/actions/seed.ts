"use server";

import { readFile } from "node:fs/promises";
import path from "node:path";
import { revalidatePath } from "next/cache";

import { requireAdmin } from "@/lib/admin-auth";
import { importApplicants, type ImportResult } from "@/lib/actions/import";
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

export type SeedGradersResult =
  | { ok: true; created: number; existing: number }
  | { ok: false; message: string };

/** Idempotent: names are unique in `graders`, so a second run adds nobody. */
export async function seedGraders(): Promise<SeedGradersResult> {
  await requireAdmin();
  if (!seedingAllowed()) {
    return { ok: false, message: "Seeding is disabled outside development." };
  }

  const { data, error } = await supabase
    .from("graders")
    .upsert(
      SEED_GRADERS.map((name) => ({ name })),
      { onConflict: "name", ignoreDuplicates: true },
    )
    .select("id");

  if (error) return { ok: false, message: `Could not seed graders: ${error.message}` };

  const created = data?.length ?? 0;
  revalidatePath("/", "layout");
  revalidatePath("/admin", "layout");

  return { ok: true, created, existing: SEED_GRADERS.length - created };
}

/**
 * Imports the bundled seed cohort.
 *
 * Reads the CSV off disk and hands it to the same action the upload button uses,
 * so seeding exercises the real parser and the real upsert rather than a
 * shortcut that could drift away from them.
 */
export async function seedApplicants(): Promise<ImportResult> {
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

  return importApplicants(csv);
}
