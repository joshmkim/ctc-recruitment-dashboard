import "server-only";

import { requireAdmin } from "@/lib/admin-auth";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";
import { getApplicant } from "@/lib/applications";
import { getDeliberationApplicants } from "@/lib/actions/deliberation";

export async function getWrittenProfile(applicantId: string) {
  await requireAdmin();
  const set = await requireActiveApplicantSet();
  const [applicant, deliberation] = await Promise.all([
    getApplicant(applicantId, set.id),
    getDeliberationApplicants(),
  ]);
  if (!applicant) throw new Error("Applicant was not found.");
  const scores = deliberation.find((row) => row.id === applicantId);
  return {
    applicant,
    graders: scores?.graders ?? [],
    rawTotal: scores?.overallAverage ? scores.overallAverage * 5 : null,
    normalizedTotal: scores?.normalizedTotal ?? null,
  };
}
