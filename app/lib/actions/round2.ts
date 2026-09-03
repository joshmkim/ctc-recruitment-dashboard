"use server";
import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin-auth";
import { assertActiveSetUnchanged, requireActiveApplicantSet } from "@/lib/applicant-sets";
import type { Decision } from "@/lib/actions/admin";
import { interviewInsertsFromCsv } from "@/lib/import/interview-rows";
import { parseRound2Csv } from "@/lib/round2/csv";
import { selectAllRows, supabase } from "@/lib/supabase";
export type Interview = { role: "lead" | "notetaker"; interviewerId: string; submittedAt: string; values: number[]; total: number; finalDecision: Decision; comments: Record<string, string>; reflections: Record<string, string> };
export type Round2Applicant = { id: string; name: string; fullName: string; graduationYear: string | null; interviews: Interview[]; total: number | null; decision: Decision | null };
export type InterviewImportResult = { ok: boolean; imported?: number; skipped?: string[]; message?: string };
const scoreColumns = "behavioral_score, challenge_score, altruism, grit, team_player, expertise, community_seeker, community_builder";
const values = (row: Record<string, unknown>) => ["behavioral_score", "challenge_score", "altruism", "grit", "team_player", "expertise", "community_seeker", "community_builder"].map((key) => Number(row[key]));
const interview = (row: Record<string, unknown>): Interview => ({ role: row.role as Interview["role"], interviewerId: String(row.interviewer_id), submittedAt: String(row.submitted_at), values: values(row), total: values(row).reduce((a, b) => a + b, 0), finalDecision: row.final_decision as Decision, comments: (row.comments ?? {}) as Record<string, string>, reflections: (row.reflections ?? {}) as Record<string, string> });
export async function importRound2Interviews(csv: string): Promise<InterviewImportResult> {
  await requireAdmin();
  let rows;
  try { rows = parseRound2Csv(csv); } catch (error) { return { ok: false, message: error instanceof Error ? error.message : "Could not read that CSV." }; }
  const set = await requireActiveApplicantSet();
  const { data: applicants, error } = await supabase.from("applicants").select("applicant_id, alias").eq("set_id", set.id);
  if (error) return { ok: false, message: error.message };
  const aliases = new Map((applicants ?? []).map((a) => [String(a.alias).toUpperCase(), a.applicant_id]));
  const { inserts, skipped } = interviewInsertsFromCsv(rows, set.id, aliases);
  if (inserts.length) {
    const { error: upsertError } = await supabase.from("round2_interviews").upsert(inserts, { onConflict: "set_id,applicant_id,role" });
    if (upsertError) return { ok: false, message: upsertError.message };
  }
  revalidatePath("/admin", "layout");
  return { ok: true, imported: inserts.length, skipped };
}
export async function getRound2Applicants(): Promise<Round2Applicant[]> { await requireAdmin(); const set = await requireActiveApplicantSet(); const [applicants, interviews, decisions] = await Promise.all([selectAllRows<{ applicant_id: string; name: string; alias: string | null; graduation_year: string | null }>("applicants", "applicant_id, name, alias, graduation_year", "applicant_id", { column: "set_id", value: set.id }), selectAllRows<Record<string, unknown>>("round2_interviews", `applicant_id, role, interviewer_id, submitted_at, ${scoreColumns}, final_decision, comments, reflections`, "submitted_at", { column: "set_id", value: set.id }), selectAllRows<{ applicant_id: string; decision: Decision }>("round2_decisions", "applicant_id, decision", "applicant_id", { column: "set_id", value: set.id })]); for (const r of [applicants, interviews, decisions]) if (r.error) throw new Error(r.error.message); const byApplicant = new Map<string, Interview[]>(); for (const row of interviews.data ?? []) { const list = byApplicant.get(String(row.applicant_id)) ?? []; list.push(interview(row)); byApplicant.set(String(row.applicant_id), list); } const decisionMap = new Map((decisions.data ?? []).map((d) => [d.applicant_id, d.decision])); return (applicants.data ?? []).map((a) => { const list = byApplicant.get(a.applicant_id) ?? []; return { id: a.applicant_id, name: a.alias ?? "—", fullName: a.name, graduationYear: a.graduation_year, interviews: list, total: list.length === 2 ? list.reduce((s, i) => s + i.total, 0) : null, decision: decisionMap.get(a.applicant_id) ?? null }; }); }
export async function getRound2Detail(applicantId: string) { await requireAdmin(); const set = await requireActiveApplicantSet(); const { data, error } = await supabase.from("round2_interviews").select(`role, interviewer_id, submitted_at, ${scoreColumns}, final_decision, comments, reflections`).eq("set_id", set.id).eq("applicant_id", applicantId); if (error) throw new Error(error.message); return (data ?? []).map((r) => interview(r)); }
export async function setRound2Decision(applicantId: string, decision: Decision, expectedSetId: string) { await requireAdmin(); const set = await assertActiveSetUnchanged(expectedSetId); if (!["admit", "lean_admit", "lean_deny", "deny"].includes(decision)) throw new Error("Invalid decision."); const { error } = await supabase.from("round2_decisions").upsert({ set_id: set.id, applicant_id: applicantId, decision, decided_at: new Date().toISOString() }, { onConflict: "set_id,applicant_id" }); if (error) throw new Error(error.message); revalidatePath("/admin", "layout"); }
export async function clearRound2Decision(applicantId: string, expectedSetId: string) { await requireAdmin(); const set = await assertActiveSetUnchanged(expectedSetId); const { error } = await supabase.from("round2_decisions").delete().eq("set_id", set.id).eq("applicant_id", applicantId); if (error) throw new Error(error.message); revalidatePath("/admin", "layout"); }
