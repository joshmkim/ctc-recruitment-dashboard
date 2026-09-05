"use client";

import { Fragment, useMemo, useState } from "react";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  ChevronsUpDownIcon,
  CircleHelpIcon,
  EyeIcon,
  EyeOffIcon,
  TriangleAlertIcon,
} from "lucide-react";

import { DecisionSelect } from "@/components/decision-select";
import { ApplicantApplicationDialog } from "@/components/applicant-application-dialog";
import { ApplicantResumeDialog } from "@/components/applicant-resume";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { Decision } from "@/lib/actions/admin";
import type { DeliberationApplicant } from "@/lib/actions/deliberation";
import {
  assignmentSlots,
} from "@/lib/grading";
import { QUESTIONS } from "@/lib/questions";
import { cn } from "@/lib/utils";

type SortKey = "overall" | "normalized" | "q1" | "q2" | "q3" | "q4" | "q5";
type RoleFilter = "all" | "designer" | "developer";
const ROLE_FILTERS: Array<{ value: RoleFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "designer", label: "Designer" },
  { value: "developer", label: "Developer" },
];

function roleFilterKey(role: string | null) {
  const value = role?.trim().toLowerCase() ?? "";
  if (value.startsWith("design")) return "designer";
  if (value.startsWith("develop")) return "developer";
  return "other";
}
const UNDECIDED = "__undecided__";
type DecisionSort = Decision | typeof UNDECIDED | null;
const DECISIONS: Array<{ value: Decision; label: string }> = [
  { value: "admit", label: "Admit" },
  { value: "lean_admit", label: "Lean admit" },
  { value: "lean_deny", label: "Lean deny" },
  { value: "deny", label: "Deny" },
];

const format = (value: number) =>
  value ? Number(value.toFixed(2)).toString() : "—";
const OVERALL_MAX = QUESTIONS.length * 4;
const formatOverall = (average: number) =>
  average
    ? `${Number((average * QUESTIONS.length).toFixed(2))}/${OVERALL_MAX}`
    : "—";
/** Signed, because the sign is the whole point: standard deviations above or
 *  below the grader's own average. Shown under the adjusted total, which is the
 *  same figure in points. */
const formatSigma = (z: number | null) =>
  z === null ? "—" : `${z >= 0 ? "+" : "−"}${Math.abs(z).toFixed(2)}σ`;
const formatNormalized = (total: number | null) =>
  total === null ? "—" : `${Number(total.toFixed(2))}/${OVERALL_MAX}`;

const GRID = "grid grid-cols-[minmax(0,1fr)_repeat(6,56px)] gap-2";

/** Why an applicant cannot be deliberated on yet, in the order that matters:
 *  an empty slot is a setup mistake, an unsubmitted score is just unfinished. */
function describeProblem(applicant: DeliberationApplicant) {
  const expected = applicant.gradersPerApplicant;
  const empty = expected - applicant.assignedCount;
  // The slot constraints make this unreachable, so seeing it means the migration
  // has not run or rows were edited by hand — which is what the banner is for.
  if (empty < 0) {
    return `${applicant.assignedCount} graders assigned, more than the ${expected} the database should allow`;
  }
  if (empty > 0) {
    return `${applicant.assignedCount} of ${expected} graders assigned — ${empty} slot${empty === 1 ? "" : "s"} never filled`;
  }
  const awaiting = applicant.graders.filter((grader) => !grader.submitted);
  return `awaiting ${awaiting.map((grader) => grader.graderName).join(" and ")}`;
}

export function DeliberationTable({
  activeSetId,
  gradersPerApplicant,
  applicants,
}: {
  activeSetId: string;
  /** From the active set. Sets created before the move to three graders keep
   *  their two, so this is not a constant. */
  gradersPerApplicant: number;
  applicants: DeliberationApplicant[];
}) {
  const [sortKey, setSortKey] = useState<SortKey>("overall");
  const [descending, setDescending] = useState(true);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [showNames, setShowNames] = useState(false);
  const [decisionFirst, setDecisionFirst] = useState<DecisionSort>(null);
  const [roleFilter, setRoleFilter] = useState<RoleFilter>("all");

  const visible = useMemo(
    () =>
      roleFilter === "all"
        ? applicants
        : applicants.filter((applicant) => roleFilterKey(applicant.role) === roleFilter),
    [applicants, roleFilter],
  );

  const problems = useMemo(
    () => visible.filter((applicant) => !applicant.ready),
    [visible],
  );

  const rows = useMemo(() => {
    const column = sortKey.startsWith("q") ? Number(sortKey[1]) - 1 : null;
    return [...visible].sort((left, right) => {
      // Anything not ready sorts to the top regardless of direction. Its averages
      // come from partial data, so ranking it against finished rows would lie.
      if (left.ready !== right.ready) return left.ready ? 1 : -1;
      if (decisionFirst) {
        const leftPreferred =
          decisionFirst === UNDECIDED
            ? left.decision === null
            : left.decision === decisionFirst;
        const rightPreferred =
          decisionFirst === UNDECIDED
            ? right.decision === null
            : right.decision === decisionFirst;
        if (leftPreferred !== rightPreferred) return leftPreferred ? -1 : 1;
      }
      // A missing normalized score sorts to the bottom whichever way the column
      // points. Zero would put it mid-pack now that the scale is signed.
      const a =
        sortKey === "normalized"
          ? left.normalizedZ ?? (descending ? -Infinity : Infinity)
          : column === null
            ? left.overallAverage
            : left.questionAverages[column];
      const b =
        sortKey === "normalized"
          ? right.normalizedZ ?? (descending ? -Infinity : Infinity)
          : column === null
            ? right.overallAverage
            : right.questionAverages[column];
      return descending ? b - a : a - b;
    });
  }, [visible, decisionFirst, descending, sortKey]);

  function toggleSort(key: SortKey) {
    if (key === sortKey) setDescending((current) => !current);
    else {
      setSortKey(key);
      setDescending(true);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-heading text-lg font-semibold text-brand-dark">Deliberation</h2>
          <p className="text-sm text-muted-foreground">
            Every applicant, scored by {gradersPerApplicant} graders. Expand a row
            to compare them question by question.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Tabs
            value={roleFilter}
            onValueChange={(value) => setRoleFilter(value as RoleFilter)}
          >
            <TabsList aria-label="Filter by role">
              {ROLE_FILTERS.map((filter) => (
                <TabsTrigger key={filter.value} value={filter.value}>
                  {filter.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
          <Dialog>
            <DialogTrigger
              render={
                <Button type="button" variant="outline" size="sm">
                  <CircleHelpIcon />
                  Explain normalization
                </Button>
              }
            />
            <DialogContent className="sm:max-w-lg">
              <DialogHeader>
                <DialogTitle>How normalization works</DialogTitle>
                <DialogDescription>
                  Normalized scores help make results comparable when graders use
                  the rubric more strictly or generously.
                </DialogDescription>
              </DialogHeader>
              <div className="flex flex-col gap-3 text-sm text-secondary-foreground">
                <p>
                  Every total a grader submits goes into their own average and
                  spread. A score becomes a z-score: how many standard deviations
                  above or below that grader&rsquo;s own average it sits. An
                  applicant&rsquo;s normalized score is the mean of their
                  graders&rsquo; z-scores, so +0.50σ means half a standard
                  deviation better than the typical application its graders read.
                </p>
                <p>
                  That is then mapped back onto the {OVERALL_MAX}-point scale as
                  the adjusted total, so it can be read against the raw one. Both
                  say the same thing; sorting uses the σ figure, which is not
                  clamped at the ends.
                </p>
                <p>
                  This removes both how high a grader scores and how widely they
                  spread their scores. A grader who never leaves the 3&ndash;4
                  band and one who uses the whole range end up equally
                  influential, which a plain average does not manage.
                </p>
                <p>
                  Figures use only the current applicant version. A grader with
                  very few submissions has their spread pulled toward the whole
                  set&rsquo;s, so two similar scores cannot divide into a wild
                  result before they have a track record.
                </p>
              </div>
            </DialogContent>
          </Dialog>
          <Button
            type="button"
            variant="outline"
            size="sm"
            aria-pressed={showNames}
            onClick={() => setShowNames((current) => !current)}
          >
            {showNames ? <EyeOffIcon /> : <EyeIcon />}
            {showNames ? "Hide names" : "Show names"}
          </Button>
        </div>
      </div>

      {problems.length ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/10 px-5 py-4">
          <p className="flex items-center gap-2 font-heading font-semibold text-destructive">
            <TriangleAlertIcon className="size-4 shrink-0" />
            {problems.length} of {visible.length} applicant
            {visible.length === 1 ? "" : "s"} {problems.length === 1 ? "is" : "are"} not
            ready to deliberate
          </p>
          <ul className="mt-2.5 flex flex-col gap-1 text-sm text-destructive">
            {problems.map((applicant) => (
              <li key={applicant.id}>
                <span className="font-medium">{labelFor(applicant, showNames)}</span> —{" "}
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
                <th className="px-3 py-3">Role</th>
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
                <th className="px-3 py-3 text-center">Scored</th>
                <SortHeader
                  label="Normalized"
                  title="Adjusts each grader’s total for their current-version scoring tendency, estimated only from applicants they co-graded."
                  active={sortKey === "normalized"}
                  descending={descending}
                  onClick={() => toggleSort("normalized")}
                />
                <th className="px-3 py-3">
                  <Select
                    items={DECISIONS}
                    value={decisionFirst}
                    onValueChange={(value) =>
                      setDecisionFirst(
                        typeof value === "string" ? (value as DecisionSort) : null,
                      )
                    }
                  >
                    <SelectTrigger
                      size="sm"
                      aria-label="Order applicants by decision"
                      className="border-0 bg-transparent p-0 text-xs font-medium tracking-wide text-muted-foreground uppercase hover:text-brand-dark"
                    >
                      <SelectValue placeholder="Decision" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={null}>All decisions</SelectItem>
                      <SelectItem value={UNDECIDED}>Undecided first</SelectItem>
                      {DECISIONS.map((decision) => (
                        <SelectItem key={decision.value} value={decision.value}>
                          {decision.label} first
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </th>
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
                          aria-label={`Show grader breakdown for ${labelFor(applicant, showNames)}`}
                          onClick={() => setExpanded(isExpanded ? null : applicant.id)}
                          className="rounded p-1 hover:bg-muted"
                        >
                          {isExpanded ? <ChevronUpIcon className="size-4" /> : <ChevronDownIcon className="size-4" />}
                        </button>
                      </td>
                      <td className="px-3 py-3">
                        <ApplicantLabel applicant={applicant} showNames={showNames} />
                        <div className="mt-2">
                          <ApplicantApplicationDialog
                            applicantId={applicant.id}
                            label={labelFor(applicant, showNames)}
                          />
                        </div>
                        {!applicant.ready ? (
                          <p className="text-xs text-destructive">{describeProblem(applicant)}</p>
                        ) : null}
                      </td>
                      <td className="px-3 py-3 text-sm">
                        {applicant.role ?? "—"}
                      </td>
                      {applicant.questionAverages.map((value, index) => (
                        <td key={index} className="px-3 py-3 text-center tabular-nums">
                          {format(value)}
                        </td>
                      ))}
                      <td className="px-3 py-3 text-center font-semibold tabular-nums text-brand-dark">
                        {formatOverall(applicant.overallAverage)}
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
                        {applicant.scoredCount}/{applicant.gradersPerApplicant}
                      </td>
                      <td className="px-3 py-3 text-center">
                        {applicant.normalizedZ !== null ? (
                          <div className="flex flex-col items-center gap-0.5">
                            <span className="rounded-full bg-brand-soft px-2 py-1 text-xs font-medium tabular-nums text-brand-dark">
                              {formatNormalized(applicant.normalizedTotal)}
                            </span>
                            <span className="text-[11px] tabular-nums text-muted-foreground">
                              {formatSigma(applicant.normalizedZ)}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-3 py-3">
                        <DecisionSelect
                          activeSetId={activeSetId}
                          applicantId={applicant.id}
                          decision={applicant.decision}
                        />
                      </td>
                    </tr>
                    {isExpanded ? (
                      <tr className="border-t border-border bg-muted/25">
                        <td colSpan={12} className="px-5 py-4">
                          <div className="mb-3 flex flex-wrap gap-2">
                            <ApplicantApplicationDialog
                              applicantId={applicant.id}
                              label={labelFor(applicant, showNames)}
                            />
                            <ApplicantResumeDialog resumeUrl={applicant.resumeUrl} />
                          </div>
                          <div className="max-w-3xl overflow-hidden rounded-xl border border-border bg-card">
                            <div className={cn(GRID, "border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium text-muted-foreground")}>
                              <span>Grader</span>
                              {QUESTIONS.map((question, index) => (
                                <span key={question.id} className="text-center">Q{index + 1}</span>
                              ))}
                              <span className="text-center">Avg</span>
                            </div>

                            {assignmentSlots(applicant.gradersPerApplicant).map((slot) => {
                              const grader = applicant.graders.find((item) => item.slot === slot);
                              return (
                                <div key={slot} className={cn(GRID, "border-b border-border px-3 py-2 text-sm last:border-b-0")}>
                                  <span className="truncate">
                                    {grader ? (
                                      <>
                                        <span className="font-medium">{grader.graderName}</span>
                                        <span className="block text-xs text-muted-foreground">
                                          {grader.submitted
                                            ? normalizationLabel(grader)
                                            : "not submitted"}
                                        </span>
                                      </>
                                    ) : (
                                      <span className="text-destructive">Slot {slot} unassigned</span>
                                    )}
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
                          </div>
                          {applicant.graders.some((grader) => grader.comments) ? (
                            <div className="mt-3 max-w-3xl overflow-hidden rounded-xl border border-border bg-card">
                              <p className="border-b border-border bg-muted/40 px-3 py-2 text-xs font-medium tracking-wide text-muted-foreground uppercase">
                                Comments
                              </p>
                              {applicant.graders
                                .filter((grader) => grader.comments)
                                .map((grader) => (
                                  <div
                                    key={grader.graderId}
                                    className="border-b border-border px-3 py-3 last:border-b-0"
                                  >
                                    <p className="text-sm font-medium text-brand-dark">
                                      {grader.graderName}
                                    </p>
                                    <p className="mt-1 whitespace-pre-wrap text-sm text-secondary-foreground">
                                      {grader.comments}
                                    </p>
                                  </div>
                                ))}
                            </div>
                          ) : null}
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
          <p className="font-medium text-brand-dark">
            {applicants.length && roleFilter !== "all"
              ? `No ${roleFilter}s in this set.`
              : "No applicants yet."}
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {applicants.length && roleFilter !== "all"
              ? "Switch back to All to see every applicant."
              : "Applicants appear here as soon as the application source has rows."}
          </p>
        </div>
      )}
    </div>
  );
}

function labelFor(applicant: DeliberationApplicant, showNames: boolean) {
  return showNames ? applicant.fullName : applicant.name;
}

function normalizationLabel(grader: DeliberationApplicant["graders"][number]) {
  if (!grader.hasSufficientHistory) {
    const count = grader.stats.submissions;
    return `Insufficient history (${count} submission${count === 1 ? "" : "s"})`;
  }

  const { tendency } = grader;
  if (Math.abs(tendency) < 0.05) return "Neutral scoring tendency";
  return `${tendency > 0 ? "+" : "−"}${Math.abs(tendency).toFixed(1)} ${
    tendency > 0 ? "generous" : "strict"
  }`;
}

function ApplicantLabel({
  applicant,
  showNames,
}: {
  applicant: DeliberationApplicant;
  showNames: boolean;
}) {
  if (!showNames) {
    return (
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-sm font-medium tracking-wide text-brand-dark">
          {applicant.name}
        </span>
        {applicant.graduationYear ? (
          <span className="text-xs text-muted-foreground">{applicant.graduationYear}</span>
        ) : null}
      </p>
    );
  }

  return (
    <div>
      <p className="font-medium text-brand-dark">{applicant.fullName}</p>
      <p className="flex items-baseline gap-2">
        <span className="font-mono text-xs tracking-wide text-muted-foreground">
          {applicant.name}
        </span>
        {applicant.graduationYear ? (
          <span className="text-xs text-muted-foreground">{applicant.graduationYear}</span>
        ) : null}
      </p>
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
