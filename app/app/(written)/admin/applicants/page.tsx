import { ApplicantExports } from "@/components/applicant-exports";
import { ApplicantImport } from "@/components/applicant-import";
import { ApplicantSetList } from "@/components/applicant-set-list";
import { SeedPanel } from "@/components/seed-panel";
import { listApplicantSets } from "@/lib/applicant-sets";
import { getApplicants } from "@/lib/applications";

/** The project ref out of the Supabase URL, so the seed panel can name the
 *  database it is about to write to. Not a secret; the URL is public. */
function supabaseProject() {
  try {
    return new URL(process.env.SUPABASE_URL ?? "").hostname.split(".")[0];
  } catch {
    return "unknown";
  }
}

export default async function ApplicantsPage() {
  const [applicants, sets] = await Promise.all([getApplicants(), listApplicantSets()]);

  return (
    <div className="flex flex-col gap-5">
      <ApplicantImport current={applicants.length} />
      <ApplicantSetList sets={sets} />
      <ApplicantExports />
      {/* Seeding is development-only, and the action refuses independently of
          this check so a production deploy cannot be talked into it. */}
      {process.env.NODE_ENV === "production" ? null : (
        <SeedPanel project={supabaseProject()} />
      )}
    </div>
  );
}
