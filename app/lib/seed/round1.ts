/**
 * Builds a Round 1 interview Google Form CSV for the seeded cohort.
 *
 * Lives outside `lib/actions/seed.ts` because a `"use server"` file may only
 * export async functions. Interviewer ids are derived from the seeded grader
 * names so the form's "USC ID" column looks like a netid rather than a uuid.
 */

import { SEED_GRADERS } from "@/lib/seed/graders";
import { mulberry32 } from "@/lib/assignment-plan";

export const ROUND1_PASSED = 60;

/** Google Form headers. Stems must uniquely match `ROUND1_COLUMNS`. */
export const ROUND1_SEED_HEADERS = [
  "Timestamp",
  "USC ID",
  "Interviewee code",
  "Role",
  "Behavioral notes",
  "Dev/design challenge notes",
  "Strengths",
  "Weaknesses",
  "Additional comments and concerns",
  "Did they seem passionate about CTC and our mission?",
  "Was their dev/design challenge well thought out?",
  "Do you think they'd make a valuable addition to the CTC community?",
  "Anything else?",
  "Behavioral score",
  "Challenge score",
  "Altruism",
  "Grit",
  "Team player",
  "Expertise",
  "Community seeker",
  "Community builder",
  "Final decision",
] as const;

const COMMENT_POOL = [
  "Clear example from a student org, and they could talk about what they would do differently.",
  "A bit rehearsed, but the follow-up about who actually used the work was specific.",
  "Struggled to get past the surface of the prompt until we asked a second time.",
  "Good listener — they adjusted the approach after the first piece of feedback.",
  "Talked more about the tech than the people affected, then course-corrected.",
  "",
  "",
];

const CHALLENGE_POOL = [
  "The first idea was generic. The second pass had an actual constraint and a reason for it.",
  "Thought out loud in a way that was easy to follow, even when the answer was incomplete.",
  "Jumped to a framework before naming the user. Came back when we asked who it was for.",
  "Solid decomposition. The tradeoff they picked was defensible.",
  "",
];

const STRENGTH_POOL = [
  "Curious without performing it. Asked a real question back.",
  "Warm with the other interviewer, not just with us as a panel.",
  "Could explain a technical choice in plain language.",
  "Took a miss on the challenge without getting brittle.",
  "",
];

const WEAKNESS_POOL = [
  "Needed a lot of prompting to get to a concrete example.",
  "A little more polish than substance on the behavioral.",
  "Did not leave much time for the second half of the challenge.",
  "",
  "",
];

const ADDITIONAL_POOL = [
  "Would want to see them in a work session before a hard yes.",
  "No concerns beyond the usual first-round noise.",
  "Energy was a bit flat, which may just have been nerves.",
  "",
];

const PASSIONATE_POOL = [
  "Yes — they talked about service work as something they already do, not something they would start.",
  "Mostly yes. The CTC-specific part was thinner than the personal project part.",
  "Hard to tell. They agreed with everything we said about the mission.",
  "",
];

const CHALLENGE_THOUGHT_POOL = [
  "Yes. They named a constraint, dropped a feature, and could say why.",
  "Partly. The diagram was clear; the who-it-is-for was not.",
  "Not really — it stayed at the level of a class project pitch.",
  "",
];

const VALUABLE_POOL = [
  "Yes. I would be happy to have them in a project group.",
  "Lean yes. I want to see the written again before I am confident.",
  "Unsure. Fine person, unclear fit for how we actually work.",
  "",
];

const ANYTHING_ELSE_POOL = [
  "Thank you for a thoughtful conversation.",
  "Would interview again in round 2.",
  "",
  "",
];

const DECISIONS = ["admit", "lean admit", "lean deny", "deny"] as const;

export function interviewerUscId(name: string) {
  const parts = name.trim().toLowerCase().split(/\s+/);
  const first = parts[0] ?? "x";
  const last = parts[parts.length - 1] ?? "interviewer";
  return `${first[0]}${last}`.replace(/[^a-z]/g, "");
}

const INTERVIEWERS = SEED_GRADERS.map(interviewerUscId);

function cell(value: string | number) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function pick<T>(random: () => number, list: readonly T[]): T {
  return list[Math.floor(random() * list.length)]!;
}

function score(random: () => number) {
  if (random() < 0.08) return 1;
  return 2 + Math.floor(random() * 3);
}

function timestamp(random: () => number, role: "lead" | "notetaker") {
  const day = 20 + Math.floor(random() * 8);
  const hour = 10 + Math.floor(random() * 8);
  const minute = Math.floor(random() * 60);
  const second = Math.floor(random() * 60);
  const pad = (value: number) => String(value).padStart(2, "0");
  const offset = role === "notetaker" ? 1 : 0;
  return `8/${day}/2026 ${hour}:${pad((minute + offset) % 60)}:${pad(second)}`;
}

function decisionFromTotal(total: number) {
  if (total >= 26) return "admit";
  if (total >= 22) return "lean admit";
  if (total >= 18) return "lean deny";
  return "deny";
}

/**
 * One form row per interviewer. The last four aliases get a lead only, so the
 * dashboard's missing-notetaker state is reachable from the seed.
 */
export function buildRound1SeedCsv(aliases: string[]): string {
  const random = mulberry32(20262027);
  const lines = [ROUND1_SEED_HEADERS.map(cell).join(",")];

  aliases.forEach((alias, index) => {
    const lead = INTERVIEWERS[index % INTERVIEWERS.length]!;
    const note =
      INTERVIEWERS[(index + 11) % INTERVIEWERS.length] === lead
        ? INTERVIEWERS[(index + 12) % INTERVIEWERS.length]!
        : INTERVIEWERS[(index + 11) % INTERVIEWERS.length]!;
    const roles: Array<"lead" | "notetaker"> =
      index >= aliases.length - 4 ? ["lead"] : ["lead", "notetaker"];

    for (const role of roles) {
      const interviewer = role === "lead" ? lead : note;
      const values = Array.from({ length: 8 }, () => score(random));
      const total = values.reduce((sum, value) => sum + value, 0);
      const finalDecision =
        random() < 0.12 ? pick(random, DECISIONS) : decisionFromTotal(total);

      lines.push(
        [
          timestamp(random, role),
          interviewer,
          alias,
          role === "lead" ? "Lead" : "Notetaker",
          pick(random, COMMENT_POOL),
          pick(random, CHALLENGE_POOL),
          pick(random, STRENGTH_POOL),
          pick(random, WEAKNESS_POOL),
          pick(random, ADDITIONAL_POOL),
          pick(random, PASSIONATE_POOL),
          pick(random, CHALLENGE_THOUGHT_POOL),
          pick(random, VALUABLE_POOL),
          pick(random, ANYTHING_ELSE_POOL),
          ...values,
          finalDecision,
        ]
          .map(cell)
          .join(","),
      );
    }
  });

  return `${lines.join("\n")}\n`;
}
