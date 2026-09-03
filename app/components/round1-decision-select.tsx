"use client";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { clearRound1Decision, setRound1Decision } from "@/lib/actions/round1";
import type { Decision } from "@/lib/actions/admin";
const options: Array<{ value: Decision; label: string }> = [{ value: "admit", label: "Admit" }, { value: "lean_admit", label: "Lean admit" }, { value: "lean_deny", label: "Lean deny" }, { value: "deny", label: "Deny" }];
export function Round1DecisionSelect({ activeSetId, applicantId, decision }: { activeSetId: string; applicantId: string; decision: Decision | null }) { const router = useRouter(); const [pending, start] = useTransition(); return <Select items={[...options, ...(decision ? [{ value: "__clear__", label: "Clear decision" }] : [])]} value={decision} onValueChange={(value) => { const selected = String(value); start(async () => { try { if (selected === "__clear__") await clearRound1Decision(applicantId, activeSetId); else await setRound1Decision(applicantId, selected as Decision, activeSetId); router.refresh(); toast.success(selected === "__clear__" ? "Decision cleared." : "Decision saved."); } catch (e) { toast.error(e instanceof Error ? e.message : "Could not save decision."); } }); }}><SelectTrigger size="sm" disabled={pending} className="min-w-28 rounded-full"><SelectValue placeholder="Status" /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}{decision ? <SelectItem value="__clear__">Clear decision</SelectItem> : null}</SelectContent></Select>; }
