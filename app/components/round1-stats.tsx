"use client";

import type { ReactNode } from "react";

import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { Interview } from "@/lib/actions/round1";
import type { WrittenProfile } from "@/components/applicant-written-profile";
import { QUESTIONS } from "@/lib/questions";
import { ROUND1_COMMENTS, ROUND1_REFLECTIONS } from "@/lib/round1/form";

const SCORE_LABELS = [
  "Behavioral",
  "Challenge",
  "Altruism",
  "Grit",
  "Team player",
  "Expertise",
  "Community seeker",
  "Community builder",
];

type Field = readonly [string, string];

export function Round1Stats({
  interviews,
  comments = ROUND1_COMMENTS,
  reflections = ROUND1_REFLECTIONS,
  written,
}: {
  interviews: Interview[];
  comments?: readonly Field[];
  reflections?: readonly Field[];
  written?: WrittenProfile | null;
}) {
  const lead = interviews.find((item) => item.role === "lead");
  const notetaker = interviews.find((item) => item.role === "notetaker");
  const cumulative =
    lead && notetaker ? lead.total + notetaker.total : null;

  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h3 className="font-heading font-semibold text-brand-dark">Applicant stats</h3>
      <Tabs defaultValue="interviews" className="mt-3">
        <TabsList>
          <TabsTrigger value="interviews">Interviews</TabsTrigger>
          <TabsTrigger value="written">Written</TabsTrigger>
        </TabsList>
        <TabsContent value="interviews" className="pt-3">
          <p className="mb-3 text-sm font-semibold uppercase tracking-wide">
            Interview round | Cumulative raw score: {cumulative ?? "N/A"}/64
          </p>
          <div className="grid gap-6 md:grid-cols-2">
            <InterviewerColumn
              role="Lead"
              interview={lead}
              comments={comments}
              reflections={reflections}
            />
            <InterviewerColumn
              role="Notetaker"
              interview={notetaker}
              comments={comments}
              reflections={reflections}
            />
          </div>
        </TabsContent>
        <TabsContent value="written" className="pt-3">
          <WrittenScores written={written} />
        </TabsContent>
      </Tabs>
    </section>
  );
}

function InterviewerColumn({
  role,
  interview,
  comments,
  reflections,
}: {
  role: string;
  interview: Interview | undefined;
  comments: readonly Field[];
  reflections: readonly Field[];
}) {
  return (
    <article>
      <p className="font-medium">
        {role}: {interview?.interviewerId ?? "N/A"}
      </p>
      <Section title="Scores">
        {SCORE_LABELS.map((label, index) => (
          <li key={label}>
            {label}: {interview ? interview.values[index] : "N/A"}
          </li>
        ))}
        <li className="font-semibold">
          Total: {interview ? `${interview.total} / 32` : "N/A / 32"}
        </li>
      </Section>
      <Section title="Comments">
        {comments.map(([key, label]) => (
          <li key={key}>
            {label}: {text(interview?.comments[key])}
          </li>
        ))}
      </Section>
      <Section title="Reflections">
        {reflections.map(([key, label]) => (
          <li key={key}>
            {label}: {text(interview?.reflections[key])}
          </li>
        ))}
      </Section>
    </article>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="mt-3">
      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        {title}
      </p>
      <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">{children}</ul>
    </div>
  );
}

function WrittenScores({ written }: { written?: WrittenProfile | null }) {
  if (written === undefined) {
    return <p className="text-sm text-muted-foreground">Loading written scores…</p>;
  }
  if (!written) {
    return <p className="text-sm text-muted-foreground">N/A</p>;
  }

  const { graders, rawTotal, normalizedTotal } = written;

  return (
    <div className="text-sm">
      <p>
        Raw score: {rawTotal?.toFixed(2) ?? "N/A"}/20
      </p>
      <p>
        Normalized score: {normalizedTotal?.toFixed(2) ?? "N/A"}/20
      </p>
      {graders.length ? (
        graders.map((grader) => (
          <article key={grader.graderId} className="mt-3 border-t border-border pt-3">
            <p className="font-medium">{grader.graderName}</p>
            <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs">
              {QUESTIONS.map((question, index) => (
                <li key={question.id}>
                  Q{index + 1}: {grader.submitted ? grader.values[index] : "N/A"}
                </li>
              ))}
              <li className="font-semibold">
                Total: {grader.submitted ? `${grader.total} / 20` : "N/A / 20"}
              </li>
            </ul>
          </article>
        ))
      ) : (
        <p className="mt-3 text-xs">Grader: N/A</p>
      )}
    </div>
  );
}

function text(value: string | undefined) {
  const trimmed = value?.trim();
  return trimmed ? trimmed : "N/A";
}
