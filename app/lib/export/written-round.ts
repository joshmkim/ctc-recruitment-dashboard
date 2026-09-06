import Papa from "papaparse";

import type { Decision } from "@/lib/actions/admin";
import type { WrittenRoundApplicant } from "@/lib/actions/deliberation";
import { assignmentSlots } from "@/lib/grading";
import { QUESTIONS } from "@/lib/questions";

const RESULTS: Record<Decision, { label: string; order: number }> = {
  admit: { label: "Admit", order: 0 },
  lean_admit: { label: "Lean admit", order: 1 },
  lean_deny: { label: "Lean reject", order: 2 },
  deny: { label: "Reject", order: 3 },
};

function roleOrder(role: string | null) {
  const value = role?.trim().toLowerCase() ?? "";
  if (value.startsWith("develop") || value === "dev") return 0;
  if (value.startsWith("design")) return 1;
  return 2;
}

/** One row per application, with fixed columns even when the round is empty. */
export function writtenRoundCsv(
  applicants: WrittenRoundApplicant[],
  gradersPerApplicant: number,
) {
  const slots = assignmentSlots(gradersPerApplicant);
  const fields = [
    "Role", "Final Result", "Alias", "Name", "Email", "Application ID",
    "Submitted At", "Student ID", "Majors", "Minors", "Graduation Year",
    "Pronouns", "Gender", "Race / Ethnicity", "Resume URL", "Other Links",
    "Commitments", "Graders Assigned", "Graders Submitted", "Graders Required",
    "Ready to Deliberate", "Raw Total (out of 20)", "Normalized Total (out of 20)",
    "Normalized Z",
    ...QUESTIONS.flatMap((question) => [
      `${question.id.toUpperCase()} Response: ${question.label}`,
      `${question.id.toUpperCase()} Average`,
    ]),
    ...slots.flatMap((slot) => [
      `Grader ${slot} Name`,
      `Grader ${slot} Submitted`,
      ...QUESTIONS.map((question) => `Grader ${slot} ${question.id.toUpperCase()} Score`),
      `Grader ${slot} Total`,
      `Grader ${slot} Comments`,
    ]),
  ];

  const rows = [...applicants].sort((left, right) =>
    roleOrder(left.profile.role) - roleOrder(right.profile.role) ||
    (left.decision ? RESULTS[left.decision].order : 4) -
      (right.decision ? RESULTS[right.decision].order : 4) ||
    (left.fullName ?? left.name).localeCompare(right.fullName ?? right.name) ||
    left.id.localeCompare(right.id),
  );

  const data = rows.map((applicant) => {
    const { profile, scores } = applicant;
    return [
      profile.role ?? "",
      applicant.decision ? RESULTS[applicant.decision].label : "No decision",
      applicant.name,
      applicant.fullName ?? "",
      applicant.id.split("#")[0],
      applicant.id,
      applicant.submittedAt,
      profile.studentId ?? "",
      profile.majors ?? "",
      profile.minors ?? "",
      profile.graduationYear ?? "",
      profile.pronouns ?? "",
      profile.gender ?? "",
      profile.raceEthnicity ?? "",
      profile.resumeUrl ?? "",
      profile.otherLinks ?? "",
      profile.commitments ?? "",
      scores.assignedCount,
      scores.scoredCount,
      scores.gradersPerApplicant,
      scores.ready ? "Yes" : "No",
      scores.scoredCount ? scores.overallAverage * QUESTIONS.length : "",
      scores.normalizedTotal ?? "",
      scores.normalizedZ ?? "",
      ...QUESTIONS.flatMap((question, index) => [
        applicant.responses[question.id],
        scores.scoredCount ? scores.questionAverages[index] : "",
      ]),
      ...slots.flatMap((slot) => {
        const grader = scores.graders.find((entry) => entry.slot === slot);
        return [
          grader?.graderName ?? "",
          grader?.submitted ? "Yes" : "No",
          ...QUESTIONS.map((_, index) => grader?.submitted ? grader.values[index] : ""),
          grader?.submitted ? grader.total : "",
          grader?.comments ?? "",
        ];
      }),
    ];
  });

  return Papa.unparse({ fields, data }, { escapeFormulae: true });
}
