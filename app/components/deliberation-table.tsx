"use client";

import { Fragment, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { DecisionSelect } from "@/components/decision-select";
import type { DeliberationApplicant } from "@/lib/actions/deliberation";
import {
  ASSIGNMENT_SLOTS,
  GRADERS_PER_APPLICANT,
  SIGNIFICANT_GAP,
} from "@/lib/grading";
import { QUESTIONS } from "@/lib/questions";
import { cn } from "@/lib/utils";

type SortKey = "overall" | "q1" | "q2" | "q3" | "q4" | "q5";

const format = (value: number) => (value ? value.toFixed(2) : "—");

const GRID = "grid grid-cols-[minmax(0,1fr)_repeat(6,56px)] gap-2";

/** Why an applicant cannot be deliberated on yet, in the order that matters:
 *  an empty slot is a setup mistake, an unsubmitted score is just unfinished. */
function describeProblem(applicant: DeliberationApplicant) {
  const empty = GRADERS_PER_APPLICANT - applicant.assignedCount;
  // The slot constraints make this unreachable, so seeing it means the migration
  // has not run or rows were edited by hand — which is what the banner is for.
  if (empty < 0) {
    return `${applicant.assignedCount} graders assigned, more than the ${GRADERS_PER_APPLICANT} the database should allow`;
  }
  if (empty > 0) {
    return `${applicant.assignedCount} of ${GRADERS_PER_APPLICANT} graders assigned — ${empty} slot${empty === 1 ? "" : "s"} never filled`;
  }
  const awaiting = applicant.graders.filter((grader) => !grader.submitted);
  return `awaiting ${awaiting.map((grader) => grader.graderName).join(" and ")}`;
}

export function DeliberationTable({ applicants }: { applicants: DeliberationApplicant[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [descending, setDescending] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);

  const problems = useMemo(
    () => applicants.filter((applicant) => !applicant.ready),
    [applicants],
  );

  const rows = useMemo(() => {
    const column = sortKey === "overall" ? null : Number(sortKey[1]) - 1;
    return [...applicants].sort((left, right) => {
      // Anything not ready sorts to the top regardless of direction. Its averages
      // come from partial data, so ranking it against finished rows would lie.
      if (left.ready !== right.ready) return left.ready ? 1 : -1;
      const a = column === null ? left.overallAverage : left.questionAverages[column];
      const b = column === null ? right.overallAverage : right.questionAverages[column];
      return descending ? b - a : a - b;
    });
  }, [applicants, descending, sortKey]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDescending((current) => !current);
    else {
      setSortKey(key);
      setDescending(true);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="font-heading text-lg font-semibold text-brand-dark">Deliberation</h2>
        <p className="text-sm text-muted-foreground">
          Every applicant, scored by {GRADERS_PER_APPLICANT} graders. Expand a row
          to compare the two question by question.
        </p>
      </div>

      {problems.length ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4">
          <p className="flex items-center gap-2 font-heading font-semibold text-destructive">
            <TriangleAlertIcon className="size-4 shrink-0" />
            {problems.length} of {applicants.length} applicant
            {applicants.length === 1 ? "" : "s"} {problems.length === 1 ? "is" : "are"} not
            ready to deliberate
          </p>
          <ul className="mt-2.5 flex flex-col gap-1 text-sm text-destructive">
            {problems.map((applicant) => (
              <li key={applicant.id}>
                <span className="font-medium">{applicant.name}</span> —{" "}
                {describeProblem(applicant)}
              </li>
            ))}
          </ul>
          <p className="mt-2.5 text-xs text-destructive/80">
            Listed first in the table below. Resolve these before deciding, or their
            averages will be based on partial scores.
          </p>
        </div>
      ) : null}

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
                <th className="px-3 py-3">Scored</th>
                <th className="px-3 py-3" title="Largest gap between the two graders on any one question">
                  Max gap
                </th>
                <th className="px-3 py-3">Decision</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((applicant) => {
                const isExpanded = expanded === applicant.id;
                return (
                  <Fragment key={applicant.id}>
                    <tr
                      className={cn(
                        "border-t border-border hover:bg-muted/25",
                        !applicant.ready && "bg-destructive/[0.04]",
                      )}
                    >
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
                        {!applicant.ready ? (
                          <p className="text-xs text-destructive">{describeProblem(applicant)}</p>
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
                      {/* Counted against the invariant, not against however many
                          graders happen to be assigned, so a missing slot reads
                          1/2 rather than a reassuring 1/1. */}
                      <td
                        className={cn(
                          "px-3 py-3 text-center tabular-nums",
                          !applicant.ready && "font-medium text-destructive",
                        )}
                      >
                        {applicant.scoredCount}/{GRADERS_PER_APPLICANT}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {applicant.questionGaps.length ? (
                          <span
                            className={cn(
                              "rounded-full px-2 py-1 text-xs font-medium tabular-nums",
                              applicant.maxGap >= SIGNIFICANT_GAP
                                ? "bg-destructive/10 text-destructive"
                                : "bg-brand-soft text-brand-dark",
                            )}
                          >
                            {applicant.maxGap}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <DecisionSelect applicantId={applicant.id} decision={applicant.decision} />
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-border bg-muted/25">
                        <td colSpan={11} className="px-5 py-4">
                          <div className="max-w-3xl overflow-hidden rounded-xl border border-border bg-card">
                            <div className={cn(GRID, "border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground")}>
                              <span>Grader</span>
                              {QUESTIONS.map((question, index) => (
                                <span key={question.id} className="text-center">Q{index + 1}</span>
                              ))}
                              <span className="text-center">Avg</span>
                            </div>

                            {ASSIGNMENT_SLOTS.map((slot) => {
                              const grader = applicant.graders.find((item) => item.slot === slot);
                              return (
                                <div key={slot} className={cn(GRID, "border-b border-border px-3 py-2 text-sm last:border-b-0")}>
                                  <span className="truncate">
                                    {grader ? (
                                      <span className="font-medium">{grader.graderName}</span>
                                    ) : (
                                      <span className="text-destructive">Slot {slot} unassigned</span>
                                    )}
                                    {grader && !grader.submitted ? (
                                      <span className="text-destructive"> · not submitted</span>
                                    ) : null}
                                  </span>
                                  {QUESTIONS.map((question, index) => (
                                    <span
                                      key={question.id}
                                      className={cn(
                                        "text-center tabular-nums",
                                        !grader?.submitted && "text-muted-foreground",
                                      )}
                                    >
                                      {grader?.submitted ? grader.values[index] : "—"}
                                    </span>
                                  ))}
                                  <span className="text-center font-semibold tabular-nums">
                                    {grader?.submitted ? grader.overall.toFixed(2) : "—"}
                                  </span>
                                </div>
                              );
                            })}

                            {applicant.questionGaps.length ? (
                              <div className={cn(GRID, "bg-muted/40 px-3 py-2 text-sm")}>
                                <span className="text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                  Gap
                                </span>
                                {applicant.questionGaps.map((gap, index) => (
                                  <span
                                    key={index}
                                    className={cn(
                                      "text-center tabular-nums",
                                      gap >= SIGNIFICANT_GAP
                                        ? "font-semibold text-destructive"
                                        : "text-muted-foreground",
                                    )}
                                  >
                                    {gap}
                                  </span>
                                ))}
                                <span />
                              </div>
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
          <p className="font-medium text-brand-dark">No applicants yet.</p>
          <p className="mt-1 text-sm text-muted-foreground">
            Applicants appear here as soon as the application source has rows.
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
