import Papa from "papaparse";

import { parseFormTimestamp } from "./form-timestamp";
import { QUESTION_IDS, type QuestionId } from "@/lib/questions";

/**
 * Parses the Google Form's response sheet, exported as CSV, into rows ready to
 * upsert into `applicants`.
 *
 * Two things about this file are load-bearing.
 *
 * It uses a real CSV parser rather than splitting on commas and newlines. The
 * form's answers contain both, and the Lightning Talks question contains
 * literal newlines in its own header, so the header alone spans three lines of
 * the export. A line-based parse does not fail on that — it succeeds and hands
 * back nonsense, which is how a grader ends up scoring half an essay.
 *
 * It binds columns by header text rather than by position, because column order
 * is not a promise Google Forms makes. Insert a question into the form and every
 * later answer shifts one column left, silently filing each answer under the
 * previous question's prompt. Nothing about that looks like an error.
 */

/** Answers shorter than this are almost certainly a placeholder or a parse
 *  failure rather than a real response, so they are reported for a human to
 *  glance at. They are still imported: a real short answer is the applicant's
 *  choice, and dropping it would be worse than showing it. */
const SUSPICIOUSLY_SHORT = 40;

export type ApplicantRow = {
  applicant_id: string;
  name: string;
  submitted_at: string;
  responses: Record<QuestionId, string>;
  role: string | null;
  student_id: string | null;
  majors: string | null;
  minors: string | null;
  graduation_year: string | null;
  pronouns: string | null;
  gender: string | null;
  race_ethnicity: string | null;
  resume_url: string | null;
  other_links: string | null;
  commitments: string | null;
};

export type ParseReport = {
  rows: ApplicantRow[];
  /** Rows with no email at all. Overwhelmingly the blank trailing rows a sheet
   *  accumulates, so they are counted rather than treated as failures. */
  blankRows: number;
  /** Resubmissions collapsed to the most recent, by email. */
  duplicates: Array<{ email: string; kept: string; discarded: number }>;
  /** Things a human should look at, which did not stop the import. */
  warnings: string[];
};

/**
 * Distinctive opening words of each column's header, normalised the same way the
 * headers are.
 *
 * Deliberately a stem rather than the full prompt. The full text carries a
 * character limit ("900 characters max") and a typo or two, both of which get
 * edited eventually; matching the opening clause survives that while still
 * being specific enough that no two columns collide.
 */
const COLUMNS = {
  timestamp: "timestamp",
  email: "email address",
  studentId: "student id",
  name: "full name",
  majors: "major(s)",
  minors: "minor(s)",
  graduationYear: "graduation year",
  pronouns: "pronouns",
  gender: "gender",
  raceEthnicity: "race & ethnicity",
  resume: "resume",
  otherLinks: "other links",
  role: "role",
  q1: "what is important to you",
  q2: "community is a core pillar",
  q3: "write a short thank-you note",
  q4: "please briefly describe any relevant technical or group work experiences",
  q5: "at ctc, one of our favorite traditions",
  commitments: "please list out any relevant classes",
} as const;

type ColumnKey = keyof typeof COLUMNS;

/** Collapses the embedded newlines and runs of spaces in form headers, and folds
 *  the curly apostrophes Google substitutes into straight ones, so the stems
 *  above can be written as plain lowercase text. */
function normaliseHeader(header: string) {
  return header
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201c\u201d]/g, '"')
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/**
 * Resolves every column to an index, and refuses to go on if any stem matches no
 * column or more than one.
 *
 * Failing loudly here is the whole point. The alternative — a missing column
 * quietly reading as an empty string — produces an import that looks like it
 * worked and applications with a blank question nobody notices until
 * deliberation.
 */
function mapColumns(headers: string[]): Record<ColumnKey, number> {
  const normalised = headers.map(normaliseHeader);
  const mapping = {} as Record<ColumnKey, number>;
  const problems: string[] = [];

  for (const [key, stem] of Object.entries(COLUMNS) as Array<[ColumnKey, string]>) {
    const matches = normalised
      .map((header, index) => ({ header, index }))
      .filter((column) => column.header.startsWith(stem));

    if (matches.length === 1) {
      mapping[key] = matches[0].index;
    } else if (matches.length === 0) {
      problems.push(`No column starts with "${stem}" (expected for ${key}).`);
    } else {
      problems.push(
        `${matches.length} columns start with "${stem}" (expected for ${key}): ${matches
          .map((column) => `#${column.index + 1}`)
          .join(", ")}.`,
      );
    }
  }

  if (problems.length) {
    throw new Error(
      [
        "The CSV's columns do not match what the app expects, so nothing was imported.",
        ...problems,
        "Either the form changed or this is the wrong export. Update COLUMNS in lib/import/applicant-csv.ts to match the form.",
      ].join("\n"),
    );
  }

  return mapping;
}

/** Empty strings become null so the column reads as "not provided" rather than
 *  as an answer of "". Kept out of `responses`, where "" is meaningful. */
function optional(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

/**
 * Keeps only the http(s) URLs in a link column.
 *
 * The value reaches an `href`, and a `javascript:` or `data:` URL there runs
 * when a grader clicks it. Google writes this column itself for a file upload,
 * but the sheet is editable by anyone the club shares it with, and the import
 * accepts whatever the export contains — so the column cannot be assumed safe
 * just because of where it usually comes from.
 *
 * Filters parts rather than rejecting the whole value: a question allowing
 * several uploads records every URL comma-separated, and one bad entry must not
 * discard the applicant's other attachments.
 */
function safeUrls(value: string | null) {
  if (!value) return null;

  const safe = value
    .split(/[,\s]+/)
    .filter(Boolean)
    .filter((part) => {
      try {
        const { protocol } = new URL(part);
        return protocol === "http:" || protocol === "https:";
      } catch {
        return false;
      }
    });

  return safe.length ? safe.join(", ") : null;
}

export function parseApplicantCsv(csv: string): ParseReport {
  // Papa handles quoted commas, escaped quotes, and newlines inside fields.
  // Headers are read manually rather than with `header: true` so a duplicated
  // prompt cannot silently overwrite its twin in an object keyed by header.
  const parsed = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: "greedy" });
  const [headers, ...dataRows] = parsed.data;

  if (!headers?.length) {
    throw new Error("That file has no header row. Export the sheet again as CSV.");
  }

  const columns = mapColumns(headers);
  const warnings: string[] = [];

  // Papa reports malformed quoting here. It still returns rows, and those rows
  // are the ones most likely to have a truncated essay, so surface it.
  for (const error of parsed.errors) {
    warnings.push(
      `CSV problem on line ${(error.row ?? 0) + 1}: ${error.message}. Check that applicant's answers.`,
    );
  }

  const byEmail = new Map<string, { row: ApplicantRow; discarded: number }>();
  const duplicates: ParseReport["duplicates"] = [];
  let blankRows = 0;

  // A row with more fields than there are headers means a quote did not close
  // where the parser thought it did, which shifts every later answer of that row
  // into the wrong question. It is the one failure that produces a plausible
  // import of wrong data, so it stops the whole thing rather than warning.
  // Fewer fields is harmless — trailing empty columns just read as blank.
  const overflowing = dataRows
    .map((cells, index) => ({ cells, row: index + 2 }))
    .filter((entry) => entry.cells.length > headers.length);

  if (overflowing.length) {
    throw new Error(
      [
        `${overflowing.length} row${overflowing.length === 1 ? "" : "s"} in that CSV have more fields than the header does, so answers would be filed under the wrong questions. Nothing was imported.`,
        ...overflowing.map(
          (entry) =>
            `Row ${entry.row}: ${entry.cells.length} fields, expected ${headers.length}.`,
        ),
        "This normally means the file was edited by hand or re-saved by another program. Export it again straight from Google Sheets.",
      ].join("\n"),
    );
  }

  dataRows.forEach((cells, index) => {
    // Line number in the file, for a warning someone can act on. The header can
    // span several physical lines, so this is approximate by design.
    const rowLabel = `row ${index + 2}`;
    const at = (key: ColumnKey) => cells[columns[key]];

    // Lowercased because the email is the key every score, assignment, and
    // decision hangs off. "Josh@usc.edu" and "josh@usc.edu" arriving as two
    // applicants would split one person's scores across two identities.
    const email = at("email")?.trim().toLowerCase();
    if (!email) {
      // An empty row is the padding a sheet accumulates and is nothing to worry
      // about. A row with answers but no email is a real application that cannot
      // be imported, since there is no key to hang its scores off, so it is
      // called out rather than counted as padding.
      if (cells.some((cell) => cell?.trim())) {
        warnings.push(
          `${rowLabel} has answers but no email address, so it could not be imported. ` +
            "Add the email in the sheet and import again.",
        );
      } else {
        blankRows += 1;
      }
      return;
    }

    const name = at("name")?.trim();
    if (!name) {
      warnings.push(`${email} (${rowLabel}) has no name; showing the email instead.`);
    }

    const submittedAt = parseFormTimestamp(at("timestamp") ?? "");
    if (!submittedAt) {
      throw new Error(
        `Could not read the timestamp "${at("timestamp")}" for ${email} (${rowLabel}). ` +
          "Expected the sheet's own format, like 8/11/2026 11:45:20. Nothing was imported.",
      );
    }

    const responses = {} as Record<QuestionId, string>;
    for (const id of QUESTION_IDS) {
      const answer = at(id)?.trim() ?? "";
      responses[id] = answer;

      if (!answer) {
        warnings.push(`${email} (${rowLabel}) left ${id.toUpperCase()} blank.`);
      } else if (answer.length < SUSPICIOUSLY_SHORT) {
        warnings.push(
          `${email} (${rowLabel}) answered ${id.toUpperCase()} in ${answer.length} characters — worth checking it imported whole.`,
        );
      }
    }

    const rawResume = optional(at("resume"));
    const resumeUrl = safeUrls(rawResume);
    if (rawResume && !resumeUrl) {
      warnings.push(
        `${email} (${rowLabel}) has a resume link that is not a web address, so it was not imported. ` +
          "Open their row in the sheet to see what is there.",
      );
    }

    const row: ApplicantRow = {
      applicant_id: email,
      name: name || email,
      submitted_at: submittedAt,
      responses,
      role: optional(at("role")),
      student_id: optional(at("studentId")),
      majors: optional(at("majors")),
      minors: optional(at("minors")),
      graduation_year: optional(at("graduationYear")),
      pronouns: optional(at("pronouns")),
      gender: optional(at("gender")),
      race_ethnicity: optional(at("raceEthnicity")),
      resume_url: resumeUrl,
      other_links: optional(at("otherLinks")),
      commitments: optional(at("commitments")),
    };

    // Resubmissions are common and the form allows them, so the latest wins.
    const existing = byEmail.get(email);
    if (!existing) {
      byEmail.set(email, { row, discarded: 0 });
      return;
    }

    const keepNew = row.submitted_at > existing.row.submitted_at;
    byEmail.set(email, {
      row: keepNew ? row : existing.row,
      discarded: existing.discarded + 1,
    });
  });

  for (const [email, entry] of byEmail) {
    if (entry.discarded > 0) {
      duplicates.push({
        email,
        kept: entry.row.submitted_at,
        discarded: entry.discarded,
      });
    }
  }

  return {
    rows: [...byEmail.values()].map((entry) => entry.row),
    blankRows,
    duplicates,
    warnings,
  };
}
