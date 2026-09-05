"use server";

import Papa from "papaparse";

import { requireAdmin } from "@/lib/admin-auth";
import { requireActiveApplicantSet, type ApplicantSet } from "@/lib/applicant-sets";
import { selectAllRows } from "@/lib/supabase";
import type { Decision } from "@/lib/actions/admin";

/**
 * The CSV is built here and handed to the browser to save, rather than served
 * from a route: these files carry real names and emails, and a server action is
 * already behind `requireAdmin()`.
 *
 * Failures come back as data for the same reason they do in `import.ts` —
 * "No active applicant set" is worth reading, and Next replaces a thrown
 * message with a generic one in production.
 */
export type ExportResult =
  | { ok: true; filename: string; csv: string; rowCount: number }
  | { ok: false; message: string };

type ApplicantRow = {
  applicant_id: string;
  name: string;
  alias: string | null;
  role: string | null;
};

/** `applicant_id` is the email plus the role — `dale@usc.edu#designer`. */
const emailOf = (applicantId: string) => applicantId.split("#")[0];

function slug(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "set";
}

function filenameFor(prefix: string, set: ApplicantSet) {
  return `${prefix}-${slug(set.name)}-${new Date().toISOString().slice(0, 10)}.csv`;
}

/** Alias, name, email and role for every applicant in the active set. */
async function loadApplicants(setId: string) {
  // Only the four columns the exports print. The essays are the bulk of an
  // applicant row and nothing here renders them.
  const { data, error } = await selectAllRows<ApplicantRow>(
    "applicants",
    "applicant_id, name, alias, role",
    "applicant_id",
    { column: "set_id", value: setId },
  );
  if (error) throw new Error(`Could not load applicants: ${error.message}`);
  return data ?? [];
}

const byName = (left: ApplicantRow, right: ApplicantRow) =>
  left.name.localeCompare(right.name);

const FIELDS = ["Alias", "Name", "Email", "Role"];

const toCsvRow = (applicant: ApplicantRow) => [
  applicant.alias ?? "",
  applicant.name,
  emailOf(applicant.applicant_id),
  applicant.role ?? "",
];

/** Built through `fields` so a set with nobody admitted still exports a header
 *  row rather than an empty file. */
const toCsv = (rows: ApplicantRow[]) =>
  Papa.unparse({ fields: FIELDS, data: rows.map(toCsvRow) });

/**
 * Everyone the written deliberation board decided to admit.
 *
 * Admit only — a lean admit is an undecided applicant, and putting one in a
 * list headed "admitted" is how someone gets an offer nobody meant to make.
 */
export async function exportAdmittedApplicants(): Promise<ExportResult> {
  await requireAdmin();

  try {
    const set = await requireActiveApplicantSet();
    const [applicants, decisions] = await Promise.all([
      loadApplicants(set.id),
      selectAllRows<{ applicant_id: string; decision: Decision }>(
        "decisions",
        "applicant_id, decision",
        "applicant_id",
        { column: "set_id", value: set.id },
      ),
    ]);
    if (decisions.error) {
      return { ok: false, message: `Could not load decisions: ${decisions.error.message}` };
    }

    const admitted = new Set(
      (decisions.data ?? [])
        .filter((row) => row.decision === "admit")
        .map((row) => row.applicant_id),
    );
    const rows = applicants.filter((applicant) => admitted.has(applicant.applicant_id));
    rows.sort(byName);

    return {
      ok: true,
      filename: filenameFor("admitted", set),
      csv: toCsv(rows),
      rowCount: rows.length,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Export failed." };
  }
}

/** Every applicant in the active set against the alias graders see them by. */
export async function exportAliasMapping(): Promise<ExportResult> {
  await requireAdmin();

  try {
    const set = await requireActiveApplicantSet();
    const rows = (await loadApplicants(set.id)).sort(byName);

    return {
      ok: true,
      filename: filenameFor("alias-mapping", set),
      csv: toCsv(rows),
      rowCount: rows.length,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Export failed." };
  }
}
