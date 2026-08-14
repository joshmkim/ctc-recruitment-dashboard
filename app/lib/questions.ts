export const QUESTION_IDS = ["q1", "q2", "q3", "q4", "q5"] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

export type Question = {
  id: QuestionId;
  /** Short label for the tab strip. */
  label: string;
  /** The full prompt as it appears on the Google Form. */
  prompt: string;
};

/**
 * The five scored questions from the 2026-27 application form, in sheet order.
 *
 * These prompts are shown to graders for context; the answers are matched to
 * them by header text in `lib/import/applicant-csv.ts`, which keys off the
 * opening clause of each one. Rewording the tail of a prompt here or in the form
 * is safe. Changing how a prompt begins means updating the matching stem too.
 *
 * The form's sixth free-text column — relevant classes and planned weekly
 * commitments — is deliberately absent. It is logistics rather than something
 * you give a 1-4 rubric score, so it is imported onto the applicant as
 * `commitments` and is not a question here.
 */
export const QUESTIONS: Question[] = [
  {
    id: "q1",
    label: "Impact",
    prompt:
      "What is important to you? Tell us about a problem you see in the world (big or small), what actions you’ve taken to make a positive impact, and what you learned. (900 characters max)",
  },
  {
    id: "q2",
    label: "Community",
    prompt:
      "Community is a core pillar of CTC. Tell us about a community you felt like you truly belonged to. What aspects do you hope to bring into the CTC family? (900 characters max)",
  },
  {
    id: "q3",
    label: "Gratitude",
    prompt:
      "Write a short thank-you note acknowledging someone who has taught you something valuable and why it mattered (not a family member). (~200 words, flexible)",
  },
  {
    id: "q4",
    label: "Technical",
    prompt:
      "Please describe any relevant technical or project experiences (personal projects, internships, research, etc). Feel free to also share any technologies, skills, or experiences you are excited about and are eager to learn more about. (600 characters max)",
  },
  {
    id: "q5",
    label: "Lightning Talk",
    prompt:
      "At CTC, one of our favorite traditions is Lightning Talks, where a member gives a short presentation on an interest, passion, or hobby. What would you give a lightning talk on and why? (450 characters max)",
  },
];
