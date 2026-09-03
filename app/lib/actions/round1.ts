"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { assertActiveSetUnchanged, requireActiveApplicantSet } from "@/lib/applicant-sets";
import type { Decision } from "@/lib/actions/admin";
import { parseRound1Csv } from "@/lib/round1/csv";
import { selectAllRows, supabase } from "@/lib/supabase";

export type Interview = { role: "lead" | "notetaker"; interviewerId: string; submittedAt: string; values: number[]; total: number; finalDecision: Decision; comments: Record<string, string>; reflections: Record<string, string> };
export type Round1Applicant = { id: string; name: string; fullName: string; graduationYear: string | null; interviews: Interview[]; total: number | null; decision: Decision | null };
export type InterviewImportResult = { ok: boolean; imported?: number; skipped?: string[]; message?: string };
const scoreColumns = "behavioral_score, challenge_score, altruism, grit, team_player, expertise, community_seeker, community_builder";
const values = (row: Record<string, unknown>) => ["behavioral_score", "challenge_score", "altruism", "grit", "team_player", "expertise", "community_seeker", "community_builder"].map((key) => Number(row[key]));
const asInterview = (row: Record<string, unknown>): Interview => ({ role: row.role as Interview["role"], interviewerId: String(row.interviewer_id), submittedAt: String(row.submitted_at), values: values(row), total: values(row).reduce((a, b) => a + b, 0), finalDecision: row.final_decision as Decision, comments: (row.comments ?? {}) as Record<string, string>, reflections: (row.reflections ?? {}) as Record<string, string> });

export async function importRound1Interviews(csv: string): Promise<InterviewImportResult> {
  await requireAdmin();
  let rows;
  try { rows = parseRound1Csv(csv); } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not read that CSV." }; }
  const set = await requireActiveApplicantSet();
  const { data: applicants, error } = await supabase.from("applicants").select("applicant_id, alias").eq("set_id", set.id);
  if (error) return { ok: false, message: error.message };
  const aliases = new Map((applicants ?? []).map((applicant) => [String(applicant.alias).toUpperCase(), applicant.applicant_id]));
  const skipped: string[] = []; const inserts: Record<string, unknown>[] = [];
  for (const row of rows) {
    const applicantId = aliases.get(row.applicantCode.toUpperCase());
    if (!applicantId) { skipped.push(`${row.applicantCode}: no matching applicant alias.`); continue; }
    if (row.role !== "lead" && row.role !== "notetaker") { skipped.push(`${row.applicantCode}: role must be Lead or Notetaker.`); continue; }
    inserts.push({ set_id: set.id, applicant_id: applicantId, role: row.role, interviewer_id: row.interviewerId, submitted_at: new Date(row.submittedAt).toISOString(), behavioral_score: row.behavioralScore, challenge_score: row.challengeScore, altruism: row.altruism, grit: row.grit, team_player: row.teamPlayer, expertise: row.expertise, community_seeker: row.communitySeeker, community_builder: row.communityBuilder, final_decision: row.finalDecision, comments: row.comments, reflections: row.reflections });
  }
  if (inserts.length) {
    const { error: insertError } = await supabase.from("round1_interviews").upsert(inserts, { onConflict: "set_id,applicant_id,role" });
    if (insertError) return { ok: false, message: insertError.message };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, imported: inserts.length, skipped };
}

export async function getRound1Applicants(): Promise<Round1Applicant[]> {
  await requireAdmin(); const set = await requireActiveApplicantSet();
  const [applicants, interviews, decisions] = await Promise.all([
    selectAllRows<{ applicant_id: string; name: string; alias: string | null; graduation_year: string | null }>("applicants", "applicant_id, name, alias, graduation_year", "applicant_id", { column: "set_id", value: set.id }),
    selectAllRows<Record<string, unknown>>("round1_interviews", `applicant_id, role, interviewer_id, submitted_at, ${scoreColumns}, final_decision, comments, reflections`, "submitted_at", { column: "set_id", value: set.id }),
    selectAllRows<{ applicant_id: string; decision: Decision }>("round1_decisions", "applicant_id, decision", "applicant_id", { column: "set_id", value: set.id }),
  ]);
  for (const result of [applicants, interviews, decisions]) if (result.error) throw new Error(result.error.message);
  const interviewMap = new Map<string, Interview[]>(); for (const row of interviews.data ?? []) { const item = asInterview(row); const list = interviewMap.get(String(row.applicant_id)) ?? []; list.push(item); interviewMap.set(String(row.applicant_id), list); }
  const decisionMap = new Map((decisions.data ?? []).map((row) => [row.applicant_id, row.decision]));
  return (applicants.data ?? []).map((applicant) => { const list = interviewMap.get(applicant.applicant_id) ?? []; return { id: applicant.applicant_id, name: applicant.alias ?? "—", fullName: applicant.name, graduationYear: applicant.graduation_year, interviews: list, total: list.length === 2 ? list.reduce((sum, item) => sum + item.total, 0) : null, decision: decisionMap.get(applicant.applicant_id) ?? null }; });
}
export async function getRound1Detail(applicantId: string) { await requireAdmin(); const set = await requireActiveApplicantSet(); const { data, error } = await supabase.from("round1_interviews").select(`role, interviewer_id, submitted_at, ${scoreColumns}, final_decision, comments, reflections`).eq("set_id", set.id).eq("applicant_id", applicantId); if (error) throw new Error(error.message); return (data ?? []).map((row) => asInterview(row)); }
export async function setRound1Decision(applicantId: string, decision: Decision, expectedSetId: string) { await requireAdmin(); const set = await assertActiveSetUnchanged(expectedSetId); if (!["admit", "lean_admit", "lean_deny", "deny"].includes(decision)) throw new Error("Invalid decision."); const { error } = await supabase.from("round1_decisions").upsert({ set_id: set.id, applicant_id: applicantId, decision, decided_at: new Date().toISOString() }, { onConflict: "set_id,applicant_id" }); if (error) throw new Error(error.message); revalidatePath("/admin", "layout"); }
export async function clearRound1Decision(applicantId: string, expectedSetId: string) { await requireAdmin(); const set = await assertActiveSetUnchanged(expectedSetId); const { error } = await supabase.from("round1_decisions").delete().eq("set_id", set.id).eq("applicant_id", applicantId); if (error) throw new Error(error.message); revalidatePath("/admin", "layout"); }
