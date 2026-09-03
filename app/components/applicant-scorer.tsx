"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { ArrowLeftIcon, ArrowRightIcon, CheckIcon } from "lucide-react";
import { toast } from "sonner";

import { useGrader } from "@/components/grader-provider";
import { ScoreSelector } from "@/components/score-selector";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ValuesRubric } from "@/components/values-rubric";
import type { Assignment } from "@/lib/actions/assignments";
import { getMyScores, submitScores } from "@/lib/actions/scores";
import type { Applicant } from "@/lib/applications";
import { QUESTIONS, type QuestionId } from "@/lib/questions";
import { SCORE_LEVELS, SCORE_VALUES, type ScoreValue } from "@/lib/scores";
import { cn } from "@/lib/utils";

type Draft = Record<QuestionId, ScoreValue | null>;

const EMPTY_DRAFT: Draft = { q1: null, q2: null, q3: null, q4: null, q5: null };

type StoredDraft = {
  scores: Draft;
  comments: string;
};

function parseStoredDraft(raw: string): StoredDraft {
  const parsed = JSON.parse(raw) as unknown;
  if (
    parsed &&
    typeof parsed === "object" &&
    "scores" in parsed &&
    parsed.scores &&
    typeof parsed.scores === "object"
  ) {
    const stored = parsed as { scores: Draft; comments?: unknown };
    return {
      scores: { ...EMPTY_DRAFT, ...stored.scores },
      comments: typeof stored.comments === "string" ? stored.comments : "",
    };
  }
  return { scores: { ...EMPTY_DRAFT, ...(parsed as Draft) }, comments: "" };
}

function draftKey(setId: string, graderId: string, applicantId: string) {
  return `ctc.draft.${setId}.${graderId}.${applicantId}`;
}

function classYearLabel(graduationYear: string) {
  const year = graduationYear.match(/\b20\d{2}\b/)?.[0];
  const classYear: Record<string, string> = {
    "2027": "Senior",
    "2028": "Junior",
    "2029": "Sophomore",
    "2030": "Freshman",
  };
  return year && classYear[year] ? `${classYear[year]} · ${year}` : graduationYear;
}

export function ApplicantScorer({
  setId,
  applicant,
  queue,
  assignments,
}: {
  setId: string;
  applicant: Applicant;
  queue: { id: string; alias: string }[];
  assignments: Assignment[];
}) {
  const { grader } = useGrader();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<QuestionId>("q1");
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [comments, setComments] = useState("");
  const [loaded, setLoaded] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  const myQueue = useMemo(() => {
    if (!grader) return [];
    const mine = new Set(
      assignments
        .filter((a) => a.grader_id === grader.id)
        .map((a) => a.applicant_id),
    );
    return queue.filter((item) => mine.has(item.id));
  }, [assignments, grader, queue]);

  const position = myQueue.findIndex((item) => item.id === applicant.id);
  const previous = position > 0 ? myQueue[position - 1] : null;
  const next =
    position >= 0 && position < myQueue.length - 1 ? myQueue[position + 1] : null;

  // A local draft is the more recent edit, so it wins over anything already
  // submitted. The component is keyed on applicant id, so this runs once per
  // applicant and every setState happens asynchronously.
  useEffect(() => {
    let cancelled = false;
    const stored = grader
      ? window.localStorage.getItem(draftKey(setId, grader.id, applicant.id))
      : null;

    const load = grader
      ? getMyScores(applicant.id, setId).catch(() => null)
      : Promise.resolve(null);

    load.then((saved) => {
      if (cancelled) return;
      setAlreadySubmitted(Boolean(saved));
      if (stored) {
        try {
          const parsed = parseStoredDraft(stored);
          setDraft(parsed.scores);
          setComments(parsed.comments || saved?.comments || "");
        } catch {
          setDraft(saved?.scores ?? EMPTY_DRAFT);
          setComments(saved?.comments ?? "");
        }
      } else if (saved) {
        setDraft(saved.scores);
        setComments(saved.comments);
      }
      setLoaded(true);
    });

    return () => {
      cancelled = true;
    };
  }, [applicant.id, grader, setId]);

  const persistDraft = useCallback(
    (scores: Draft, nextComments: string) => {
      if (!grader) return;
      window.localStorage.setItem(
        draftKey(setId, grader.id, applicant.id),
        JSON.stringify({ scores, comments: nextComments }),
      );
    },
    [applicant.id, grader, setId],
  );

  const setScore = useCallback(
    (question: QuestionId, value: ScoreValue) => {
      setDraft((current) => {
        const updated = { ...current, [question]: value };
        persistDraft(updated, comments);
        return updated;
      });
    },
    [comments, persistDraft],
  );

  function updateComments(value: string) {
    setComments(value);
    persistDraft(draft, value);
  }

  const scoredCount = QUESTIONS.filter((q) => draft[q.id] !== null).length;
  const complete = scoredCount === QUESTIONS.length;
  const overallTotal = QUESTIONS.reduce(
    (sum, question) => sum + (draft[question.id] ?? 0),
    0,
  );
  const overallMax = QUESTIONS.length * SCORE_VALUES[SCORE_VALUES.length - 1];

  function handleSubmit() {
    if (!grader || !complete) return;

    startTransition(async () => {
      try {
        await submitScores(
          applicant.id,
          draft as Record<QuestionId, ScoreValue>,
          setId,
          comments,
        );
        window.localStorage.removeItem(draftKey(setId, grader.id, applicant.id));
        setConfirmOpen(false);
        toast.success("Scores saved");
        router.push(next ? `/score/${encodeURIComponent(next.alias)}` : "/written");
      } catch (error) {
        toast.error(
          error instanceof Error ? error.message : "Could not save your scores.",
        );
      }
    });
  }

  return (
    // Essays on the left, values on the right. The left column is min-w-0 so a
    // long unbroken line in an answer cannot push the values panel off screen.
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(19rem,23rem)]">
      <div className="flex min-w-0 flex-col gap-5">
        <h1 className="flex items-baseline gap-3 font-heading text-2xl font-semibold tracking-tight text-brand-dark">
          <span className="font-mono">{applicant.name}</span>
          {applicant.profile.graduationYear ? (
            <span className="text-muted-foreground">
              {classYearLabel(applicant.profile.graduationYear)}
            </span>
          ) : null}
        </h1>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <p className="text-sm text-muted-foreground">
            Submitted{" "}
            {new Date(applicant.submittedAt).toLocaleDateString(undefined, {
              day: "numeric",
              month: "long",
              year: "numeric",
            })}
            {position >= 0 && myQueue.length > 0 ? (
              <> · {position + 1} of {myQueue.length} assigned to you</>
            ) : null}
          </p>
          <div className="flex items-center gap-2">
            {alreadySubmitted ? (
              <span className="rounded-full bg-brand-soft px-2.5 py-1 text-xs font-medium text-secondary-foreground">
                Already submitted
              </span>
            ) : null}
            <span className="text-sm font-medium tabular-nums text-muted-foreground">
              {scoredCount} of {QUESTIONS.length} scored
            </span>
          </div>
        </div>

        {!grader ? (
          <p className="rounded-xl border border-brand/40 bg-brand-soft px-4 py-3 text-sm text-secondary-foreground">
            Pick your name in the top right before you start scoring.
          </p>
        ) : null}

        <Tabs
          value={activeTab}
          onValueChange={(value) => setActiveTab(value as QuestionId)}
        >
          <TabsList variant="line" className="h-auto flex-wrap gap-1.5 p-0">
            {QUESTIONS.map((question, index) => {
              const scored = draft[question.id] !== null;
              return (
                <TabsTrigger
                  key={question.id}
                  value={question.id}
                  className={cn(
                    "h-auto flex-none gap-2 rounded-xl border border-border bg-card px-3 py-2",
                    // Weight and a coloured border mark the active tab, rather than
                    // reversing it out in white — which read as lighter than the
                    // tabs beside it, the opposite of what selection should look like.
                    "data-active:border-primary data-active:font-semibold data-active:text-brand-dark",
                  )}
                >
                  <span
                    className={cn(
                      "size-1.5 rounded-full transition-colors",
                      scored
                        ? "bg-brand group-data-active/tabs-list:bg-brand"
                        : "bg-border",
                    )}
                    aria-hidden
                  />
                  Q{index + 1}
                  <span className="hidden text-xs opacity-70 sm:inline">
                    {question.label}
                  </span>
                </TabsTrigger>
              );
            })}
          </TabsList>

          {QUESTIONS.map((question) => (
            <TabsContent key={question.id} value={question.id}>
              <article className="rounded-2xl border border-border bg-card p-6 sm:p-8">
                <h2 className="mb-5 max-w-[68ch] font-heading text-base leading-relaxed font-semibold text-brand-dark">
                  {question.prompt}
                </h2>
                <div className="max-w-[68ch] space-y-4 text-[1.0625rem] leading-8 whitespace-pre-wrap text-foreground/90">
                  {applicant.responses[question.id]}
                </div>
              </article>
            </TabsContent>
          ))}
        </Tabs>

        <div className="rounded-2xl border border-border bg-card p-4 sm:p-5">
          <ScoreSelector
            value={loaded ? draft[activeTab] : null}
            onChange={(value) => setScore(activeTab, value)}
            rubric={
              QUESTIONS.find((question) => question.id === activeTab)?.rubric ??
              QUESTIONS[0].rubric
            }
          />
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <Button
            variant="outline"
            size="lg"
            disabled={!previous}
            onClick={() =>
              previous &&
              router.push(`/score/${encodeURIComponent(previous.alias)}`)
            }
          >
            <ArrowLeftIcon />
            Previous
          </Button>

          <div className="flex items-center gap-2">
            {next ? (
              <Button
                variant="ghost"
                size="lg"
                onClick={() =>
                  router.push(`/score/${encodeURIComponent(next.alias)}`)
                }
              >
                Skip for now
              </Button>
            ) : null}
            <Button
              size="lg"
              disabled={!grader || !complete || pending}
              onClick={() => setConfirmOpen(true)}
            >
              {next ? "Submit and next" : "Submit and finish"}
              <ArrowRightIcon />
            </Button>
          </div>
        </div>

        {!complete ? (
          <p className="text-right text-xs text-muted-foreground">
            Score all {QUESTIONS.length} questions to submit. Your progress is
            saved on this device.
          </p>
        ) : null}
      </div>

      <ValuesRubric />

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Submit these scores?</DialogTitle>
            <DialogDescription>
              {alreadySubmitted
                ? "This replaces the scores you submitted earlier."
                : "You can come back and change these later."}
            </DialogDescription>
          </DialogHeader>

          <ul className="flex flex-col gap-1.5">
            {QUESTIONS.map((question, index) => {
              const score = draft[question.id];
              const level = SCORE_LEVELS.find((l) => l.value === score);
              return (
                <li
                  key={question.id}
                  className="flex items-center justify-between gap-3 rounded-lg bg-muted/60 px-3 py-1.5 text-sm"
                >
                  <span className="text-muted-foreground">
                    Q{index + 1} · {question.label}
                  </span>
                  <span className="font-medium tabular-nums">
                    {score} {level ? level.label : ""}
                  </span>
                </li>
              );
            })}
          </ul>

          <p className="flex items-baseline justify-between gap-3 px-3 pt-1">
            <span className="text-sm text-muted-foreground">Overall</span>
            <span className="font-heading text-xl font-semibold tabular-nums text-brand-dark">
              {overallTotal}/{overallMax}
            </span>
          </p>

          <label className="flex flex-col gap-1.5">
            <span className="text-sm font-medium text-brand-dark">
              Comments{" "}
              <span className="font-normal text-muted-foreground">(optional)</span>
            </span>
            <textarea
              value={comments}
              onChange={(event) => updateComments(event.target.value)}
              placeholder="Anything the deliberation group should know."
              rows={4}
              className="w-full resize-y rounded-lg border border-input bg-transparent px-2.5 py-2 text-sm outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            />
          </label>

          <DialogFooter>
            <Button
              variant="outline"
              size="lg"
              onClick={() => setConfirmOpen(false)}
            >
              Keep editing
            </Button>
            <Button size="lg" onClick={handleSubmit} disabled={pending}>
              <CheckIcon />
              {pending ? "Saving..." : "Submit"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
