"use client";

import { AlertTriangleIcon, CheckCircle2Icon } from "lucide-react";

import type { ImportSummary } from "@/lib/actions/import";

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <li className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-1.5 text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
    </li>
  );
}

export function ImportFailure({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-4">
      <p className="flex items-center gap-2 text-sm font-medium text-destructive">
        <AlertTriangleIcon className="size-4 shrink-0" />
        Nothing was imported
      </p>
      {/* Pre-wrapped: the column-matching failure lists one problem per line. */}
      <pre className="mt-2 overflow-x-auto text-sm whitespace-pre-wrap text-destructive">
        {message}
      </pre>
    </div>
  );
}

export function ImportReport({ summary }: { summary: ImportSummary }) {
  return (
    <div className="flex flex-col gap-3">
      <p className="flex items-center gap-2 text-sm font-medium text-brand-dark">
        <CheckCircle2Icon className="size-4 shrink-0" />
        Import finished
      </p>

      <ul className="flex flex-col gap-1.5">
        <Stat label="New applicants" value={summary.created} />
        <Stat label="Existing applicants updated" value={summary.updated} />
        {summary.blankRows ? (
          <Stat label="Blank rows skipped" value={summary.blankRows} />
        ) : null}
        {summary.duplicates.length ? (
          <Stat
            label="Resubmissions collapsed to the latest"
            value={summary.duplicates.length}
          />
        ) : null}
      </ul>

      {summary.missing.length ? (
        <div className="rounded-xl border border-brand/40 bg-brand-soft p-4">
          <p className="text-sm font-medium text-brand-dark">
            {summary.missing.length} applicant
            {summary.missing.length === 1 ? " is" : "s are"} in the database but
            missing from this CSV
          </p>
          <p className="mt-1 text-sm text-secondary-foreground">
            They have been left in place, not deleted. Usually this means the sheet
            was filtered or only part of it was exported.
            {summary.missingWithScores.length
              ? ` ${summary.missingWithScores.length} of them already have submitted scores, so this is worth resolving before deliberation.`
              : ""}
          </p>
          {/* Capped: a mismatched export can list hundreds, and a wall of emails
              buries the count that actually matters. */}
          <ul className="mt-2 flex flex-col gap-0.5 text-xs text-secondary-foreground">
            {summary.missing.slice(0, 25).map((email) => (
              <li key={email} className="font-mono">
                {email}
                {summary.missingWithScores.includes(email) ? " — has scores" : ""}
              </li>
            ))}
          </ul>
          {summary.missing.length > 25 ? (
            <p className="mt-1 text-xs text-muted-foreground">
              and {summary.missing.length - 25} more
            </p>
          ) : null}
        </div>
      ) : null}

      {summary.warnings.length ? (
        <details className="rounded-xl border border-border bg-muted/40 p-4">
          <summary className="cursor-pointer text-sm font-medium">
            {summary.warnings.length} thing
            {summary.warnings.length === 1 ? "" : "s"} worth a look
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-secondary-foreground">
            {summary.warnings.map((warning) => (
              <li key={warning}>{warning}</li>
            ))}
          </ul>
        </details>
      ) : null}
    </div>
  );
}
