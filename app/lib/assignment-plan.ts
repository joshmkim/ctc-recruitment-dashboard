import { ASSIGNMENT_SLOTS, GRADERS_PER_APPLICANT, type AssignmentSlot } from "@/lib/grading";

export type AssignmentPlanRow = {
  set_id: string;
  applicant_id: string;
  grader_id: string;
  slot: AssignmentSlot;
};

export type AssignmentPlanGrader = {
  id: string;
  name: string;
  is_active: boolean;
};

type Random = () => number;

const PAIR_REPEAT_PENALTY = 4;

export function hashSeed(text: string) {
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function mulberry32(seed: number): Random {
  return () => {
    let value = (seed += 0x6d2b79f5);
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

export function pairKey(firstId: string, secondId: string) {
  return firstId < secondId ? `${firstId}:${secondId}` : `${secondId}:${firstId}`;
}

export function buildPairCounts(assignments: AssignmentPlanRow[]) {
  const gradersByApplicant = new Map<string, string[]>();
  for (const assignment of assignments) {
    const graders = gradersByApplicant.get(assignment.applicant_id);
    if (graders) graders.push(assignment.grader_id);
    else gradersByApplicant.set(assignment.applicant_id, [assignment.grader_id]);
  }

  const counts = new Map<string, number>();
  for (const graders of gradersByApplicant.values()) {
    if (graders.length !== GRADERS_PER_APPLICANT) continue;
    const key = pairKey(graders[0], graders[1]);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return counts;
}

function buildLoads(graders: AssignmentPlanGrader[], assignments: AssignmentPlanRow[]) {
  const loads = new Map(graders.map((grader) => [grader.id, 0]));
  for (const assignment of assignments) {
    loads.set(assignment.grader_id, (loads.get(assignment.grader_id) ?? 0) + 1);
  }
  return loads;
}

function chooseMinimum<T>(candidates: T[], cost: (candidate: T) => number, random: Random) {
  let lowestCost = Infinity;
  let best: T[] = [];

  for (const candidate of candidates) {
    const candidateCost = cost(candidate);
    if (candidateCost < lowestCost) {
      lowestCost = candidateCost;
      best = [candidate];
    } else if (candidateCost === lowestCost) {
      best.push(candidate);
    }
  }

  return best.length ? best[Math.floor(random() * best.length)] : undefined;
}

export function choosePartner(
  graders: AssignmentPlanGrader[],
  assignments: AssignmentPlanRow[],
  applicantId: string,
  allowedIds: Set<string> | undefined,
  random: Random,
) {
  const assigned = assignments.filter((assignment) => assignment.applicant_id === applicantId);
  const assignedIds = new Set(assigned.map((assignment) => assignment.grader_id));
  const coGraderId = assigned[0]?.grader_id;
  const loads = buildLoads(graders, assignments);
  const pairCounts = buildPairCounts(assignments);
  const candidates = graders.filter(
    (grader) =>
      grader.is_active &&
      !assignedIds.has(grader.id) &&
      (!allowedIds || allowedIds.has(grader.id)),
  );

  return chooseMinimum(
    candidates,
    (grader) =>
      (coGraderId
        ? PAIR_REPEAT_PENALTY * (pairCounts.get(pairKey(coGraderId, grader.id)) ?? 0)
        : 0) + (loads.get(grader.id) ?? 0),
    random,
  );
}

function shuffled<T>(items: T[], random: Random) {
  const result = [...items];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

export function planAssignments(
  applicants: Array<{ id: string }>,
  graders: AssignmentPlanGrader[],
  assignments: AssignmentPlanRow[],
  random: Random,
) {
  const inserts: AssignmentPlanRow[] = [];
  const current = [...assignments];
  let shortfall = 0;

  for (const applicant of shuffled(applicants, random)) {
    const existing = current.filter((assignment) => assignment.applicant_id === applicant.id);
    const filledSlots = new Set(existing.map((assignment) => assignment.slot));
    const missingSlots = ASSIGNMENT_SLOTS.filter((slot) => !filledSlots.has(slot));
    if (!missingSlots.length) continue;

    const assignedIds = new Set(existing.map((assignment) => assignment.grader_id));
    const eligible = graders.filter((grader) => grader.is_active && !assignedIds.has(grader.id));

    if (missingSlots.length === GRADERS_PER_APPLICANT) {
      const loads = buildLoads(graders, current);
      const pairCounts = buildPairCounts(current);
      const pairs: Array<[AssignmentPlanGrader, AssignmentPlanGrader]> = [];
      for (let first = 0; first < eligible.length; first += 1) {
        for (let second = first + 1; second < eligible.length; second += 1) {
          pairs.push([eligible[first], eligible[second]]);
        }
      }

      const pair = chooseMinimum(
        pairs,
        ([first, second]) =>
          PAIR_REPEAT_PENALTY * (pairCounts.get(pairKey(first.id, second.id)) ?? 0) +
          (loads.get(first.id) ?? 0) +
          (loads.get(second.id) ?? 0),
        random,
      );
      if (!pair) {
        shortfall += missingSlots.length;
        continue;
      }

      const pairInSlotOrder = random() < 0.5 ? pair : [pair[1], pair[0]];
      for (const [index, slot] of missingSlots.entries()) {
        const assignment = {
          set_id: "",
          applicant_id: applicant.id,
          grader_id: pairInSlotOrder[index].id,
          slot,
        };
        inserts.push(assignment);
        current.push(assignment);
      }
      continue;
    }

    for (const slot of missingSlots) {
      const partner = choosePartner(graders, current, applicant.id, undefined, random);
      if (!partner) {
        shortfall += missingSlots.length - missingSlots.indexOf(slot);
        break;
      }
      const assignment = { set_id: "", applicant_id: applicant.id, grader_id: partner.id, slot };
      inserts.push(assignment);
      current.push(assignment);
    }
  }

  return { inserts, shortfall };
}
