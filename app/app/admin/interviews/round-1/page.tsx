import { Round1Import } from "@/components/round1-import";
import { Round1Table } from "@/components/round1-table";
import { getRound1Applicants } from "@/lib/actions/round1";
import { requireActiveApplicantSet } from "@/lib/applicant-sets";

export default async function Round1Page() {
  const [set, applicants] = await Promise.all([requireActiveApplicantSet(), getRound1Applicants()]);
  return <div className="flex flex-col gap-6"><Round1Import /><Round1Table activeSetId={set.id} applicants={applicants} /></div>;
}
