import { DeliberationTable } from "@/components/deliberation-table";
import { getDeliberationApplicants } from "@/lib/actions/deliberation";

export default async function DeliberationPage() {
  const applicants = await getDeliberationApplicants();
  return <DeliberationTable applicants={applicants} />;
}
