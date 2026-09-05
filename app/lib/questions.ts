import { type ScoreValue } from "@/lib/scores";

export const QUESTION_IDS = ["q1", "q2", "q3", "q4", "q5"] as const;

export type QuestionId = (typeof QUESTION_IDS)[number];

/** Criteria for one score on one question, in the order graders should read them. */
export type RubricLevel = string[];

export type Question = {
  id: QuestionId;
  /** Short label for the tab strip. */
  label: string;
  /** The full prompt as it appears on the Google Form. */
  prompt: string;
  /** Finalized written-application rubric. One entry per score on the 1–4 scale. */
  rubric: Record<ScoreValue, RubricLevel>;
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
      "What is important to you? Tell us about a problem you see in the world (big or small), what actions you’ve taken to make a positive impact, and what you learned.",
    rubric: {
      1: [
        "No evidence of impact",
        "No initiative shown",
        "Little reflection",
      ],
      2: [
        "Some interest in making an impact",
        "Took some initiative",
        "Some reflection",
      ],
      3: [
        "Clear positive impact (not necessarily social though)",
        "Heavily participated in an initiative after seeing a problem",
        "Meaningful learning and growth",
      ],
      4: [
        "Strong SOCIAL impact",
        "Created or led an initiative after seeing a problem (go-getter attitude)",
        "Clear emphasis on using tech or their skills to help others",
      ],
    },
  },
  {
    id: "q2",
    label: "Community",
    prompt:
      "Community is a core pillar of CTC. Tell us about a community you felt like you truly belonged to. What aspects do you hope to bring into the CTC family?",
    rubric: {
      1: [
        "Only focuses on what CTC can do for them",
        "Little alignment with CTC values",
      ],
      2: [
        "Has a vague idea of what qualities they would want to bring",
        "Some understanding of the CTC community and values",
      ],
      3: [
        "Thoughtful reflection, put in effort to think about what qualities they would want to bring in the CTC community",
        "Values align with CTC (you would like to see these values within the community)",
      ],
      4: [
        "Clear understanding of the role they want in the community",
        "Thoughtful connection to CTC culture and values (these are must-have values for the CTC community in your opinion)",
      ],
    },
  },
  {
    id: "q3",
    label: "Gratitude",
    prompt:
      "Write a short thank-you note acknowledging someone who has taught you something valuable and why it mattered (not a family member).",
    rubric: {
      1: ["No meaningful learning", "Generic appreciation"],
      2: ["Some learning", "Some appreciation", "Limited reflection"],
      3: [
        "Meaningful lesson learned",
        "Genuine appreciation",
        "Growth mindset (will they use this in the future?)",
      ],
      4: [
        "Specific, genuine gratitude",
        "Clearly sought out learning or mentorship",
        "Humility and strong growth mindset (they’ve used it in further learning or mentioned how they would use it in the future)",
      ],
    },
  },
  {
    id: "q4",
    label: "Technical",
    prompt:
      "Please describe any relevant technical or project experiences (personal projects, internships, research, etc). Feel free to also share any technologies, skills, or experiences you are excited about and are eager to learn more about.",
    rubric: {
      1: ["Little technical experience", "No group work", "Little interest"],
      2: [
        "Enough experience to contribute",
        "Some group work/personal projects",
        "Interest in learning",
      ],
      3: [
        "Strong technical foundation",
        "Relevant projects/classes/internships",
        "Ready to contribute",
      ],
      4: [
        "Significant technical experience",
        "Immediate project contributor",
        "Exceptional initiative beyond coursework",
      ],
    },
  },
  {
    id: "q5",
    label: "Lightning Talk",
    prompt:
      "At CTC, one of our favorite traditions is Lightning Talks, where a member gives a short presentation on an interest, passion, or hobby. Topics from last year included: how to DJ, an interactive self-defense workshop, all about Niki Zefanya, and more! What would you give a lightning talk on and why?",
    rubric: {
      1: ["Not compelling", "Not genuine", "Low enthusiasm", "Seems like AI"],
      2: ["Somewhat interesting", "Some enthusiasm", "Somewhat genuine"],
      3: [
        "Genuine passion",
        "Would give a solid talk",
        "Maybe you wouldn’t want to hear this talk but they seem genuinely interested",
      ],
      4: [
        "Highly engaging",
        "Authentic enthusiasm",
        "Makes you want to attend the talk (even if you wouldn’t be interested in the topic)",
      ],
    },
  },
];
