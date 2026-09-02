"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { clearDecision, setDecision, type Decision } from "@/lib/actions/admin";

const OPTIONS: Array<{ value: Decision; label: string }> = [
  { value: "admit", label: "Admit" },
  { value: "lean_admit", label: "Lean admit" },
  { value: "lean_deny", label: "Lean deny" },
  { value: "deny", label: "Deny" },
];
const CLEAR_VALUE = "__clear__";
const decisionColors: Record<Decision, string> = {
  admit: "border-brand/35 bg-brand-soft text-brand-dark",
  lean_admit: "border-brand/25 bg-brand-soft/60 text-brand-dark",
  lean_deny: "border-amber-300/60 bg-amber-50 text-amber-900",
  deny: "border-destructive/30 bg-destructive/10 text-destructive",
};

export function DecisionSelect({
  activeSetId,
  applicantId,
  decision,
}: {
  activeSetId: string;
  applicantId: string;
  decision: Decision | null;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const items: Array<{ value: Decision | typeof CLEAR_VALUE; label: string }> = [
    ...OPTIONS,
    ...(decision
      ? [{ value: CLEAR_VALUE as typeof CLEAR_VALUE, label: "Clear decision" }]
      : []),
  ];

  return (
    <Select
      items={items}
      value={decision}
      onValueChange={(value) => {
        if (typeof value !== "string") return;
        const selected = value as string;
        startTransition(async () => {
          try {
            if (selected === CLEAR_VALUE) {
              await clearDecision(applicantId, activeSetId);
            } else {
              await setDecision(applicantId, selected as Decision, activeSetId);
            }
            router.refresh();
            toast.success(selected === CLEAR_VALUE ? "Decision cleared." : "Decision saved.");
          } catch (error) {
            toast.error(error instanceof Error ? error.message : "Could not save decision.");
          }
        });
      }}
    >
      <SelectTrigger
        size="sm"
        disabled={pending}
        className={`min-w-28 rounded-full ${
          decision ? decisionColors[decision] : "border-border bg-card text-foreground"
        }`}
      >
        <SelectValue placeholder="Decision" />
      </SelectTrigger>
      <SelectContent>
        {OPTIONS.map((option) => (
          <SelectItem
            key={option.value}
            value={option.value}
            className={decisionColors[option.value]}
          >
            {option.label}
          </SelectItem>
        ))}
        {decision ? (
          <SelectItem value={CLEAR_VALUE} className="text-destructive">
            Clear decision
          </SelectItem>
        ) : null}
      </SelectContent>
    </Select>
  );
}
