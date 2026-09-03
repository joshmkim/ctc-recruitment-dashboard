"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { ApplicantExpandPanel } from "@/components/applicant-expand-panel";
import { Round1DecisionSelect } from "@/components/round1-decision-select";
import type { Round1Applicant } from "@/lib/actions/round1";

export function Round1Table({
  activeSetId,
  applicants,
}: {
  activeSetId: string;
  applicants: Round1Applicant[];
}) {
  const [expanded, setExpanded] = useState<string | null>(null);
  const [descending, setDescending] = useState(true);
  const rows = useMemo(
    () =>
      [...applicants].sort(
        (a, b) => (descending ? 1 : -1) * ((b.total ?? -1) - (a.total ?? -1)),
      ),
    [applicants, descending],
  );
  const interviewer = (row: Round1Applicant, role: string) =>
    row.interviews.find((item) => item.role === role);

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-lg font-semibold text-brand-dark">
          Round 1 deliberation
        </h2>
        <p className="text-sm text-muted-foreground">
          Two interviews per applicant, scored out of 64.
        </p>
      </div>
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full min-w-[950px] text-sm">
          <thead className="bg-muted/45 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
            <tr>
              <th className="w-9 p-3" />
              <th className="p-3">Applicant</th>
              <th className="p-3">Grad year</th>
              <th className="p-3">Lead</th>
              <th className="p-3">Notetaker</th>
              <th className="p-3">
                <button onClick={() => setDescending(!descending)}>
                  Score {descending ? "↓" : "↑"}
                </button>
              </th>
              <th className="p-3">Lead decision</th>
              <th className="p-3">Notetaker decision</th>
              <th className="p-3">Status</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const open = expanded === row.id;
              const lead = interviewer(row, "lead");
              const note = interviewer(row, "notetaker");
              return (
                <Fragment key={row.id}>
                  <tr className="border-t border-border hover:bg-muted/25">
                    <td className="p-3">
                      <button
                        className="rounded p-1 hover:bg-muted"
                        aria-label="Toggle applicant details"
                        onClick={() => setExpanded(open ? null : row.id)}
                      >
                        {open ? (
                          <ChevronUpIcon className="size-4" />
                        ) : (
                          <ChevronDownIcon className="size-4" />
                        )}
                      </button>
                    </td>
                    <td className="p-3 font-medium text-brand-dark">
                      {row.fullName || "N/A"}
                    </td>
                    <td className="p-3">{row.graduationYear || "N/A"}</td>
                    <td className="p-3">{lead?.interviewerId ?? "N/A"}</td>
                    <td className="p-3">{note?.interviewerId ?? "N/A"}</td>
                    <td className="p-3 font-semibold tabular-nums">
                      {row.total != null ? `${row.total}/64` : "N/A"}
                    </td>
                    <td className="p-3">{label(lead?.finalDecision)}</td>
                    <td className="p-3">{label(note?.finalDecision)}</td>
                    <td className="p-3">
                      <Round1DecisionSelect
                        activeSetId={activeSetId}
                        applicantId={row.id}
                        decision={row.decision}
                      />
                    </td>
                  </tr>
                  {open ? (
                    <tr className="border-t border-border bg-muted/25">
                      <td colSpan={9} className="p-5">
                        <ApplicantExpandPanel
                          key={row.id}
                          applicantId={row.id}
                          interviews={row.interviews}
                          round={1}
                        />
                      </td>
                    </tr>
                  ) : null}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function label(value: string | undefined) {
  return value ? value.replaceAll("_", " ") : "N/A";
}
