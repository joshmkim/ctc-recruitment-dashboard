import "server-only";

import { supabase } from "@/lib/supabase";

export type ApplicantSet = {
  id: string;
  name: string;
  version: string;
  status: "draft" | "anonymized" | "active" | "archived";
  applicantCount?: number;
  activeGraderCount?: number;
};

export async function getActiveApplicantSet(): Promise<ApplicantSet | null> {
  const { data, error } = await supabase
    .from("applicant_sets")
    .select("id, name, version, status")
    .eq("status", "active")
    .maybeSingle<ApplicantSet>();
  if (error) throw new Error(`Could not load active applicant set: ${error.message}`);
  return data;
}

export async function requireActiveApplicantSet(): Promise<ApplicantSet> {
  const set = await getActiveApplicantSet();
  if (!set) throw new Error("No active applicant set. Finish an anonymized import first.");
  return set;
}

/** Refuse writes from a page that was rendered for a now-archived set. */
export async function assertActiveSetUnchanged(expectedSetId: string): Promise<ApplicantSet> {
  const set = await requireActiveApplicantSet();
  if (set.id !== expectedSetId) {
    throw new Error("The active applicant set changed while this page was open. Reload and try again.");
  }
  return set;
}

export async function listApplicantSets(): Promise<ApplicantSet[]> {
  const { data, error } = await supabase
    .from("applicant_sets")
    .select("id, name, version, status")
    .order("version", { ascending: false });
  if (error) throw new Error(`Could not load applicant sets: ${error.message}`);

  const sets = (data ?? []) as ApplicantSet[];
  const counts = await Promise.all(
    sets.map(async (set) => {
      const [applicants, graders] = await Promise.all([
        supabase
          .from("applicants")
          .select("*", { count: "exact", head: true })
          .eq("set_id", set.id),
        supabase
          .from("applicant_set_graders")
          .select("*", { count: "exact", head: true })
          .eq("set_id", set.id)
          .eq("is_active", true),
      ]);
      if (applicants.error) {
        throw new Error(`Could not count applicants: ${applicants.error.message}`);
      }
      if (graders.error) {
        throw new Error(`Could not count graders: ${graders.error.message}`);
      }
      return {
        ...set,
        applicantCount: applicants.count ?? 0,
        activeGraderCount: graders.count ?? 0,
      };
    }),
  );
  return counts;
}
