export const ROUND2_COLUMNS = {
  timestamp: "timestamp", interviewerId: "usc id", applicantCode: "interviewee code", role: "role",
  behavioralNotes: "behavioral notes", challengeNotes: "challenge notes", strengths: "strengths", weaknesses: "weaknesses", additionalComments: "additional comments and concerns",
  passionate: "did they seem passionate", logical: "did their thinking / process", feedback: "did they take feedback well", teamwork: "would you be happy to work", valuable: "do you think they'd make a valuable",
  behavioralScore: "behavioral score", challengeScore: "challenge score", altruism: "altruism", grit: "grit", teamPlayer: "team player", expertise: "expertise", communitySeeker: "community seeker", communityBuilder: "community builder", finalDecision: "final decision",
} as const;
export const ROUND2_COMMENTS = [["behavioralNotes", "Behavioral notes"], ["challengeNotes", "Challenge notes"], ["strengths", "Strengths"], ["weaknesses", "Weaknesses"], ["additionalComments", "Additional comments and concerns"]] as const;
export const ROUND2_REFLECTIONS = [["passionate", "Did they seem passionate about CTC and our mission?"], ["logical", "Did their thinking / process follow logically?"], ["feedback", "Did they take feedback well?"], ["teamwork", "Would you be happy to work in a team with this person?"], ["valuable", "Do you think they'd make a valuable addition to the CTC community?"]] as const;
