"use client";

import { Fragment, useMemo, useState } from "react";
import { ChevronDownIcon, ChevronUpIcon, ChevronsUpDownIcon } from "lucide-react";

import { DecisionSelect } from "@/components/decision-select";
import type { DeliberationApplicant } from "@/lib/actions/deliberation";
import { QUESTIONS } from "@/lib/questions";
import { cn } from "@/lib/utils";

type SortKey = "overall" | "q1" | "q2" | "q3" | "q4" | "q5";

const format = (value: number) => (value ? value.toFixed(2) : "—");

export function DeliberationTable({ applicants }: { applicants: DeliberationApplicant[] }) {
  const [showIncomplete, setShowIncomplete] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [descending, setDescending] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const rows = useMemo(() => {
    const visible = showIncomplete
      ? applicants
      : applicants.filter((applicant) => applicant.complete);
    return [...visible].sort((left, right) => {
      const a = sortKey === "overall" ? left.overallAverage : left.questionAverages[Number(sortKey[1]) - 1];
      const b = sortKey === "overall" ? right.overallAverage : right.questionAverages[Number(sortKey[1]) - 1];
      return descending ? b - a : a - b;
    });
  }, [applicants, descending, showIncomplete, sortKey]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDescending((current) => !current);
    else {
      setSortKey(key);
      setDescending(true);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-brand-dark">Deliberation</h2>
          <p className="text-sm text-muted-foreground">
            Complete applications only. Expand a row to compare grader scores.
          </p>
        </div>
        <label className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm">
          <input
            type="checkbox"
            checked={showIncomplete}
            onChange={(event) => setShowIncomplete(event.target.checked)}
          />
          Show incomplete
        </label>
      </div>

      {rows.length ? (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full min-w-[1080px] text-sm">
            <thead className="bg-muted/45 text-left text-xs font-medium tracking-wide text-muted-foreground uppercase">
              <tr>
                <th className="w-9 px-3 py-3" />
                <th className="min-w-48 px-3 py-3">Applicant</th>
                {QUESTIONS.map((question, index) => (
                  <SortHeader
                    key={question.id}
                    label={`Q${index + 1}`}
                    title={question.label}
                    active={sortKey === question.id}
                    descending={descending}
                    onClick={() => toggleSort(question.id)}
                  />
                ))}
                <SortHeader
                  label="Overall"
                  active={sortKey === "overall"}
                  descending={descending}
                  onClick={() => toggleSort("overall")}
                />
                <th className="px-3 py-3">Coverage</th>
                <th className="px-3 py-3">Spread</th>
                <th className="px-3 py-3">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((applicant) => {
                const isExpanded = expanded === applicant.id;
                return (
                  <Fragment key={applicant.id}>
                    <tr className="border-t border-border hover:bg-muted/25">
                      <td className="px-3 py-3">
                        <button
                          type="button"
                          aria-label={`Show grader breakdown for ${applicant.name}`}
                          onClick={() => setExpanded(isExpanded ? null : applicant.id)}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {isExpanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <p className="font-medium text-brand-dark">{applicant.name}</p>
                        {!applicant.complete ? (
                          <p className="text-xs text-destructive">
                            {applicant.scoredCount} of {applicant.assignedCount} submitted
                          </p>
                        ) : null}
                      </td>
                      {applicant.questionAverages.map((value, index) => (
                        <td key={index} className="px-3 py-3 text-center tabular-nums">
                          {format(value)}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center font-semibold tabular-nums text-brand-dark">
                        {format(applicant.overallAverage)}
                      </td>
                      <td className="px-3 py-3 text-center tabular-nums">
                        {applicant.scoredCount}/{applicant.assignedCount}
                      </td>
                      <td className="px-3 py-3 text-center">
                        <span
                          className={cn(
                            "rounded-full px-2 py-1 text-xs font-medium tabular-nums",
                            applicant.spread >= 1 ? "bg-destructive/10 text-destructive" : "bg-brand-soft text-brand-dark",
                          )}
                        >
                          {format(applicant.spread)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <DecisionSelect applicantId={applicant.id} decision={applicant.decision} />
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-border bg-muted/25">
                        <td colSpan={11} className="px-5 py-4">
                          <div className="flex max-w-3xl flex-col gap-3">
                            <div className="overflow-hidden rounded-xl border border-border bg-card">
                              <div className="grid grid-cols-[minmax(0,1fr)_repeat(6,56px)] gap-2 border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground">
                                <span>Grader</span>
                                {QUESTIONS.map((_, index) => <span key={index} className="text-center">Q{index + 1}</span>)}
                                <span className="text-center">Avg</span>
                              </div>
                              {applicant.scores.map((score) => (
                                <div key={score.graderId} className="grid grid-cols-[minmax(0,1fr)_repeat(6,56px)] gap-2 border-b border-border px-3 py-2 text-sm last:border-b-0">
                                  <span className="font-medium">{score.graderName}</span>
                                  {score.values.map((value, index) => <span key={index} className="text-center tabular-nums">{value}</span>)}
                                  <span className="text-center font-semibold tabular-nums">{score.overall.toFixed(2)}</span>
                                </div>
                              ))}
                            </div>
                            {applicant.awaitingGraders.length ? (
                              <p className="rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                                Awaiting scores from{" "}
                                <span className="font-medium">
                                  {applicant.awaitingGraders.map((grader) => grader.graderName).join(", ")}
                                </span>
                                .
                              </p>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ) : null}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-2xl border border-dashed border-border bg-card p-12 text-center">
          <p className="font-medium text-brand-dark">No completed applications yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Enable “Show incomplete” to see applications still awaiting scores.
          </p>
        </div>
      )}
    </div>
  );
}

function SortHeader({
  label,
  title,
  active,
  descending,
  onClick,
}: {
  label: string;
  title?: string;
  active: boolean;
  descending: boolean;
  onClick: () => void;
}) {
  const Icon = active ? (descending ? ChevronDownIcon : ChevronUpIcon) : ChevronsUpDownIcon;
  return (
    <th className="px-3 py-3 text-center" title={title}>
      <button type="button" onClick={onClick} className="inline-flex items-center gap-1 hover:text-brand-dark">
        {label} <Icon className="size-3" />
      </button>
    </th>
  );
}
