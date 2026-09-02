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
        <Stat label="Applicants staged" value={summary.applicantCount} />
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
