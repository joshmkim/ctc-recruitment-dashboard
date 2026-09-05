import type { Decision } from "@/lib/actions/admin";

export const DECISION_LABELS: Array<{ value: Decision; label: string }> = [
  { value: "admit", label: "Admit" },
  { value: "lean_admit", label: "Lean admit" },
  { value: "lean_deny", label: "Lean deny" },
  { value: "deny", label: "Deny" },
];

export const DECISION_COLORS: Record<Decision, string> = {
  admit: "border-brand/35 bg-brand-soft text-brand-dark",
  lean_admit: "border-brand/25 bg-brand-soft/60 text-brand-dark",
  lean_deny: "border-amber-300/60 bg-amber-50 text-amber-900",
  deny: "border-destructive/30 bg-destructive/10 text-destructive",
};

const labelFor = (decision: Decision) =>
  DECISION_LABELS.find((option) => option.value === decision)?.label ?? decision;

/** What the shared board shows where the admin board has a `<DecisionSelect>`.
 *  Sized and coloured to match it, so the two views read the same. */
export function DecisionBadge({ decision }: { decision: Decision | null }) {
  return (
    <span
      className={`inline-flex min-w-28 items-center justify-center rounded-full border px-3 py-1.5 text-sm ${
        decision
          ? DECISION_COLORS[decision]
          : "border-border bg-card text-muted-foreground"
      }`}
    >
      {decision ? labelFor(decision) : "No decision"}
    </span>
  );
}
