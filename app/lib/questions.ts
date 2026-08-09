export const QUESTION_IDS = ["q1", "q2", "q3", "q4", "q5"] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

export type Question = {
  id: QuestionId;
  /** Short label for the tab strip. */
  label: string;
  /** The full prompt as it appears on the Google Form. */
  prompt: string;
};

// Placeholder prompts. Replace these with the real Google Form questions; the
// ids must keep matching the q1..q5 score columns in Supabase.
export const QUESTIONS: Question[] = [
  {
    id: "q1",
    label: "Motivation",
    prompt: "Why do you want to join the club, and what do you hope to get out of it?",
  },
  {
    id: "q2",
    label: "Experience",
    prompt:
      "Tell us about a project or piece of work you are proud of. What was your role, and what did you learn?",
  },
  {
    id: "q3",
    label: "Collaboration",
    prompt:
      "Describe a time you worked with a team that disagreed. How did you handle it?",
  },
  {
    id: "q4",
    label: "Initiative",
    prompt:
      "Tell us about something you built, organised, or started on your own initiative.",
  },
  {
    id: "q5",
    label: "Contribution",
    prompt: "What would you contribute to the club that nobody else would?",
  },
];
