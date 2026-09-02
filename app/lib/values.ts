import { type ScoreValue } from "@/lib/scores";

/** One anchor on a value's 1-4 scale: the score and what it looks like. */
export type ValueAnchor = {
  score: ScoreValue;
  description: string;
};

export type ClubValue = {
  name: string;
  /** The question a grader should be asking themselves while reading. */
  question: string;
  /**
   * Only the anchors the club has written down. 2 and 3 are deliberately left
   * undefined for most values so graders read the ends of the scale and judge
   * the middle themselves, so this is a list rather than a 1-4 record.
   */
  anchors: ValueAnchor[];
};

export const VALUES_INTRO =
  "After reading each app, rate the applicant 1-4 (or unknown) keeping these values in mind. Use these guidelines, not strict rules. Use your best judgment.";

export const CLUB_VALUES: ClubValue[] = [
  {
    name: "Altruism",
    question:
      "Do they have interest and experience in community service/impact, and using tech for social good?",
    anchors: [
      {
        score: 1,
        description:
          "Don’t mention community service, positive impact or using tech for good",
      },
      {
        score: 4,
        description:
          "Have experience or examples leading community service events, making a positive impact, or creating social good via tech",
      },
    ],
  },
  {
    name: "Grit",
    question:
      "Do they show self-motivated learning, take initiative, and follow-through with their work?",
    anchors: [
      {
        score: 1,
        description:
          "Not a self-motivated learner or doesn’t take initiative, doesn’t complete their work",
      },
      {
        score: 4,
        description:
          "Show passion for learning or has shown initiative through leadership, goes above and beyond what is asked of them",
      },
    ],
  },
  {
    name: "Team Player",
    question:
      "Would this person show growth and effective collaboration within a team?",
    anchors: [
      {
        score: 1,
        description: "You would NOT want to work with them on a CTC product",
      },
      {
        score: 4,
        description: "You would love to work with them on a CTC product",
      },
    ],
  },
  {
    name: "Expertise",
    question: "Based on their technical background, how much would they contribute?",
    anchors: [
      {
        score: 1,
        description: "Equivalent of CS102 with no personal projects / new to design",
      },
      {
        score: 3,
        description:
          "Far along in CS or design coursework but less internship or project experience",
      },
      {
        score: 4,
        description:
          "Far along in equivalent coursework with an extensive portfolio, projects, or internship experience",
      },
    ],
  },
  {
    name: "Community Seeker",
    question:
      "Are they seeking community from or “want to be welcomed” into CTC?",
    anchors: [
      {
        score: 1,
        description:
          "Doesn’t seem interested in engaging socially at all, involved in a large number of other social organizations",
      },
      {
        score: 4,
        description:
          "Really emphasizes our community in their app and a desire for friends",
      },
    ],
  },
  {
    name: "Community Builder",
    question:
      "Are they a community builder and welcoming for the rest of the CTC community?",
    anchors: [
      {
        score: 1,
        description: "Doesn’t seem interested in contributing or engaging socially",
      },
      {
        score: 4,
        description:
          "Big focus on connection, bringing people together, and engaging others",
      },
    ],
  },
];
