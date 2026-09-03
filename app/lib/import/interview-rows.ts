import { parseFormTimestamp } from "./form-timestamp";

export type InterviewCsvFields = {
  applicantCode: string;
  interviewerId: string;
  role: string;
  submittedAt: string;
  behavioralScore: number;
  challengeScore: number;
  altruism: number;
  grit: number;
  teamPlayer: number;
  expertise: number;
  communitySeeker: number;
  communityBuilder: number;
  finalDecision: string;
  comments: Record<string, string>;
  reflections: Record<string, string>;
};

/**
 * Maps a parsed interview CSV onto upsert rows.
 *
 * Resubmits are common (the form allows them) and Postgres rejects a batch that
 * targets the same `(applicant, role)` twice, so later `submitted_at` wins and
 * the discarded row is reported rather than aborting the import.
 */
export function interviewInsertsFromCsv(
  rows: InterviewCsvFields[],
  setId: string,
  aliases: Map<string, string>,
): { inserts: Record<string, unknown>[]; skipped: string[] } {
  const skipped: string[] = [];
  const byKey = new Map<string, Record<string, unknown>>();

  for (const row of rows) {
    const applicantId = aliases.get(row.applicantCode.toUpperCase());
    if (!applicantId) {
      skipped.push(`${row.applicantCode}: no matching applicant alias.`);
      continue;
    }
    if (row.role !== "lead" && row.role !== "notetaker") {
      skipped.push(`${row.applicantCode}: role must be Lead or Notetaker.`);
      continue;
    }

    const submittedAt = parseFormTimestamp(row.submittedAt);
    if (!submittedAt) {
      skipped.push(
        `${row.applicantCode}: could not parse timestamp "${row.submittedAt}".`,
      );
      continue;
    }

    const insert = {
      set_id: setId,
      applicant_id: applicantId,
      role: row.role,
      interviewer_id: row.interviewerId,
      submitted_at: submittedAt,
      behavioral_score: row.behavioralScore,
      challenge_score: row.challengeScore,
      altruism: row.altruism,
      grit: row.grit,
      team_player: row.teamPlayer,
      expertise: row.expertise,
      community_seeker: row.communitySeeker,
      community_builder: row.communityBuilder,
      final_decision: row.finalDecision,
      comments: row.comments,
      reflections: row.reflections,
    };

    const key = `${applicantId}:${row.role}`;
    const existing = byKey.get(key);
    if (existing) {
      skipped.push(
        `${row.applicantCode}: duplicate ${row.role} submission; keeping the later one.`,
      );
      if (submittedAt > String(existing.submitted_at)) byKey.set(key, insert);
    } else {
      byKey.set(key, insert);
    }
  }

  return { inserts: [...byKey.values()], skipped };
}
