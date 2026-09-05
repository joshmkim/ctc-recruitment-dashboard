import type { Metadata } from "next";

import { LiveDeliberationTable } from "@/components/live-deliberation-table";
import { getSharedDeliberationApplicants } from "@/lib/actions/deliberation";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";

export const metadata: Metadata = { title: "Deliberation" };

/**
 * The admin deliberation board, for everyone.
 *
 * Read-only on purpose: `/admin/deliberation` stays the single place a decision
 * is written, so one person drives while the rest of the club follows along.
 */
export default async function SharedDeliberationPage() {
  const [set, applicants] = await Promise.all([
    requireActiveApplicantSet(),
    getSharedDeliberationApplicants(),
  ]);

  return (
    <div className="mx-auto w-full max-w-[1600px] px-6 py-8">
      <LiveDeliberationTable
        activeSetId={set.id}
        gradersPerApplicant={set.gradersPerApplicant}
        applicants={applicants}
      />
    </div>
  );
}
