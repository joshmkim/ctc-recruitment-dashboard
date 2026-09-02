import { CompassIcon } from "lucide-react";

import { CLUB_VALUES, VALUES_INTRO } from "@/lib/values";

/**
 * The club's values, shown beside the essays as a reading lens.
 *
 * Nothing here is scored — the 1-4 scale a grader actually submits is the
 * per-question rubric in `ScoreSelector`. These are the qualities to weigh
 * while reading, so the panel is reference text rather than an input.
 */
export function ValuesRubric() {
  return (
    <aside className="lg:sticky lg:top-8 lg:max-h-[calc(100vh-4rem)] lg:self-start lg:overflow-y-auto">
      <div className="flex flex-col overflow-hidden rounded-2xl border border-border bg-card">
        <div className="border-b border-border px-4 py-3">
          <h2 className="flex items-center gap-2 font-heading text-sm font-semibold text-brand-dark">
            <CompassIcon className="size-4 shrink-0" />
            Values
          </h2>
          <p className="mt-1.5 text-xs leading-5 text-muted-foreground">
            {VALUES_INTRO}
          </p>
        </div>

        <dl className="flex flex-col divide-y divide-border">
          {CLUB_VALUES.map((value) => (
            <div key={value.name} className="px-4 py-3.5">
              <dt>
                <span className="font-heading text-sm font-semibold text-foreground">
                  {value.name}
                </span>
                <span className="mt-0.5 block text-xs leading-5 text-muted-foreground">
                  {value.question}
                </span>
              </dt>
              <dd className="mt-2.5 flex flex-col gap-1.5">
                {value.anchors.map((anchor) => (
                  <div key={anchor.score} className="flex gap-2.5">
                    <span
                      className="mt-px flex size-5 shrink-0 items-center justify-center rounded-md bg-brand-soft font-heading text-xs font-semibold tabular-nums text-secondary-foreground"
                      aria-hidden
                    >
                      {anchor.score}
                    </span>
                    <span className="text-xs leading-5 text-foreground/90">
                      <span className="sr-only">Score {anchor.score}: </span>
                      {anchor.description}
                    </span>
                  </div>
                ))}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </aside>
  );
}
