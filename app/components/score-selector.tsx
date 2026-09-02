"use client";

import { cn } from "@/lib/utils";
import type { RubricLevel } from "@/lib/questions";
import { SCORE_LEVELS, type ScoreValue } from "@/lib/scores";

export function ScoreSelector({
  value,
  onChange,
  rubric,
}: {
  value: ScoreValue | null;
  onChange: (value: ScoreValue) => void;
  rubric: Record<ScoreValue, RubricLevel>;
}) {
  const selected = SCORE_LEVELS.find((level) => level.value === value);

  return (
    <div className="flex flex-col gap-3">
      <div
        role="radiogroup"
        aria-label="Score this response"
        className="grid grid-cols-4 gap-2 sm:gap-3"
      >
        {SCORE_LEVELS.map((level) => {
          const isSelected = level.value === value;
          return (
            <button
              key={level.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              onClick={() => onChange(level.value)}
              className={cn(
                "flex cursor-pointer flex-col items-center gap-0.5 rounded-2xl border-2 px-2 py-3 transition-all duration-100",
                "focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none",
                isSelected
                  ? "-translate-y-0.5 border-primary bg-primary text-primary-foreground shadow-md shadow-primary/20"
                  : "border-border bg-card text-foreground hover:border-brand hover:bg-brand-soft",
              )}
            >
              <span className="font-heading text-2xl leading-none font-semibold tabular-nums">
                {level.value}
              </span>
              <span
                className={cn(
                  "text-xs font-medium",
                  isSelected ? "text-primary-foreground/85" : "text-muted-foreground",
                )}
              >
                {level.label}
              </span>
            </button>
          );
        })}
      </div>

      <div className={cn("px-1 py-1", !selected && "text-muted-foreground")}>
        {selected ? (
          <ul className="flex flex-col gap-1.5 text-base leading-7 text-foreground">
            {rubric[selected.value].map((criterion) => (
              <li key={criterion} className="flex gap-2.5">
                <span
                  className="mt-[0.7em] size-1.5 shrink-0 rounded-full bg-brand"
                  aria-hidden
                />
                {criterion}
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-base">Pick a score to see what it means.</p>
        )}
      </div>
    </div>
  );
}
