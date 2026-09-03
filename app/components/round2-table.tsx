"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";

import { ApplicantExpandPanel } from "@/components/applicant-expand-panel";
import { Round2DecisionSelect } from "@/components/round2-decision-select";
import type { Round2Applicant } from "@/lib/actions/round2";

export function Round2Table({
  activeSetId,
  applicants,
}: {
  activeSetId: string;
  applicants: Round2Applicant[];
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

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-lg font-semibold text-brand-dark">
          Round 2 deliberation
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
              const lead = row.interviews.find((item) => item.role === "lead");
              const note = row.interviews.find((item) => item.role === "notetaker");
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
                    <td className="p-3">
                      {lead?.finalDecision?.replaceAll("_", " ") ?? "N/A"}
                    </td>
                    <td className="p-3">
                      {note?.finalDecision?.replaceAll("_", " ") ?? "N/A"}
                    </td>
                    <td className="p-3">
                      <Round2DecisionSelect
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
                          round={2}
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
