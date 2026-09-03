export const ROUND1_COLUMNS = {
  timestamp: "timestamp",
  interviewerId: "usc id",
  applicantCode: "interviewee code",
  role: "role",
  behavioralNotes: "behavioral notes",
  challengeNotes: "dev/design challenge notes",
  strengths: "strengths",
  weaknesses: "weaknesses",
  additionalComments: "additional comments and concerns",
  passionate: "did they seem passionate",
  challengeThought: "was their dev/design challenge",
  valuable: "do you think they'd make a valuable",
  anythingElse: "anything else?",
  behavioralScore: "behavioral score",
  challengeScore: "challenge score",
  altruism: "altruism",
  grit: "grit",
  teamPlayer: "team player",
  expertise: "expertise",
  communitySeeker: "community seeker",
  communityBuilder: "community builder",
  finalDecision: "final decision",
} as const;

export const ROUND1_COMMENTS = [
  ["behavioralNotes", "Behavioral notes"],
  ["challengeNotes", "Dev/design challenge notes"],
  ["strengths", "Strengths"],
  ["weaknesses", "Weaknesses"],
  ["additionalComments", "Additional comments and concerns"],
] as const;

export const ROUND1_REFLECTIONS = [
  ["passionate", "Did they seem passionate about CTC and our mission?"],
  ["challengeThought", "Was their dev/design challenge well thought out?"],
  ["valuable", "Do you think they'd make a valuable addition to the CTC community?"],
  ["anythingElse", "Anything else?"],
] as const;
