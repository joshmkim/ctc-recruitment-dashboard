import Papa from "papaparse";

import { ROUND1_COLUMNS, ROUND1_COMMENTS, ROUND1_REFLECTIONS } from "@/lib/round1/form";

type ColumnKey = keyof typeof ROUND1_COLUMNS;
export type Round1CsvRow = {
  applicantCode: string; interviewerId: string; role: string; submittedAt: string;
  behavioralScore: number; challengeScore: number; altruism: number; grit: number;
  teamPlayer: number; expertise: number; communitySeeker: number; communityBuilder: number;
  finalDecision: string; comments: Record<string, string>; reflections: Record<string, string>;
};

const normalise = (value: string) => value.replace(/[\u2018\u2019]/g, "'").replace(/[\u201c\u201d]/g, '"').replace(/\s+/g, " ").trim().toLowerCase();
function columns(headers: string[]) {
  const found = {} as Record<ColumnKey, number>;
  const problems: string[] = [];
  for (const [key, stem] of Object.entries(ROUND1_COLUMNS) as Array<[ColumnKey, string]>) {
    const matches = headers.map(normalise).map((header, index) => ({ header, index })).filter(({ header }) => header.startsWith(stem));
    if (matches.length === 1) found[key] = matches[0].index;
    else problems.push(`${matches.length ? "Multiple" : "No"} column${matches.length === 1 ? "" : "s"} match "${stem}".`);
  }
  if (problems.length) throw new Error(["The CSV columns do not match the Round 1 form.", ...problems].join("\n"));
  return found;
}
const decision = (value: string) => {
  const normalized = normalise(value).replace(/^lean reject$/, "lean deny").replace(/^reject$/, "deny");
  if (!["admit", "lean admit", "lean deny", "deny"].includes(normalized)) return null;
  return normalized.replace(" ", "_");
};
export function parseRound1Csv(csv: string): Round1CsvRow[] {
  const parsed = Papa.parse<string[]>(csv.trim(), { skipEmptyLines: "greedy" });
  if (parsed.errors.length || !parsed.data.length) throw new Error(parsed.errors[0]?.message ?? "Could not read the CSV.");
  const [headers, ...data] = parsed.data;
  const map = columns(headers);
  return data.map((row, index) => {
    const get = (key: ColumnKey) => row[map[key]]?.trim() ?? "";
    const scores = ["behavioralScore", "challengeScore", "altruism", "grit", "teamPlayer", "expertise", "communitySeeker", "communityBuilder"] as const;
    const result = Object.fromEntries(scores.map((key) => [key, Number(get(key))])) as Pick<Round1CsvRow, typeof scores[number]>;
    if (!get("applicantCode") && !get("interviewerId")) return null;
    if (!get("applicantCode") || !get("interviewerId") || !get("timestamp")) throw new Error(`Row ${index + 2} is missing its code, interviewer ID, or timestamp.`);
    if (scores.some((key) => !Number.isInteger(result[key]) || result[key] < 1 || result[key] > 4)) throw new Error(`Row ${index + 2} has a score outside 1–4.`);
    const finalDecision = decision(get("finalDecision"));
    if (!finalDecision) throw new Error(`Row ${index + 2} has an unrecognized final decision.`);
    return {
      applicantCode: get("applicantCode"), interviewerId: get("interviewerId"), role: normalise(get("role")), submittedAt: get("timestamp"),
      ...result, finalDecision,
      comments: Object.fromEntries(ROUND1_COMMENTS.map(([key]) => [key, get(key)])),
      reflections: Object.fromEntries(ROUND1_REFLECTIONS.map(([key]) => [key, get(key)])),
    };
  }).filter((row): row is Round1CsvRow => Boolean(row));
}
