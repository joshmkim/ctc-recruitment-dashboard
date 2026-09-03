import { Round2Import } from "@/components/round2-import";
import { Round2Table } from "@/components/round2-table";
import { getRound2Applicants } from "@/lib/actions/round2";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";

export default async function Round2Page() {
  const [set, applicants] = await Promise.all([requireActiveApplicantSet(), getRound2Applicants()]);
  return <div className="flex flex-col gap-6"><Round2Import /><Round2Table activeSetId={set.id} applicants={applicants} /></div>;
}
