import "server-only";

import { getWrittenScoreSummary } from "@/lib/actions/deliberation";
import { requireAdmin } from "@/lib/admin-auth";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";
import { getApplicant } from "@/lib/applications";

export async function getWrittenProfile(applicantId: string) {
  await requireAdmin();
  const set = await requireActiveApplicantSet();
  const [applicant, scores] = await Promise.all([
    getApplicant(applicantId, set.id, { includeFullName: true }),
    getWrittenScoreSummary(applicantId, set.id),
  ]);
  if (!applicant) throw new Error("Applicant was not found.");
  return {
    applicant,
    graders: scores.graders,
    rawTotal: scores.ready ? scores.overallAverage * 5 : null,
    normalizedTotal: scores.normalizedTotal,
  };
}
