import { DeliberationTable } from "@/components/deliberation-table";
import { getDeliberationApplicants } from "@/lib/actions/deliberation";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";

export default async function DeliberationPage() {
  const [set, applicants] = await Promise.all([
    requireActiveApplicantSet(),
    getDeliberationApplicants(),
  ]);
  return (
    <DeliberationTable
      activeSetId={set.id}
      gradersPerApplicant={set.gradersPerApplicant}
      applicants={applicants}
    />
  );
}
