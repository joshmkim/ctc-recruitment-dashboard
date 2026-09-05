import { assignmentSlots, type AssignmentSlot } from "@/lib/grading";

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

/**
 * How often each unordered grader pair has read the same application.
 *
 * With three graders an applicant contributes three pairs, not one, and
 * spreading those is what "cross-grader diversity" means here — a trio that
 * reuses one familiar pair is only two-thirds fresh. Partially assigned
 * applicants count too, since their existing pairs are already real.
 */
export function buildPairCounts(assignments: AssignmentPlanRow[]) {
  const gradersByApplicant = new Map<string, string[]>();
  for (const assignment of assignments) {
    const graders = gradersByApplicant.get(assignment.applicant_id);
    if (graders) graders.push(assignment.grader_id);
    else gradersByApplicant.set(assignment.applicant_id, [assignment.grader_id]);
  }

  const counts = new Map<string, number>();
  for (const graders of gradersByApplicant.values()) {
    for (let first = 0; first < graders.length; first += 1) {
      for (let second = first + 1; second < graders.length; second += 1) {
        const key = pairKey(graders[first], graders[second]);
        counts.set(key, (counts.get(key) ?? 0) + 1);
      }
    }
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

/**
 * The next grader to add to an applicant.
 *
 * Cost is the repeat count of the pairs this grader would form with everyone
 * already on the applicant, weighted against how much work they are carrying.
 * Summing over all of them rather than just the first is what lets a third
 * grader avoid a stale pairing with either of the two already there.
 */
export function choosePartner(
  graders: AssignmentPlanGrader[],
  assignments: AssignmentPlanRow[],
  applicantId: string,
  allowedIds: Set<string> | undefined,
  random: Random,
) {
  const assigned = assignments.filter((assignment) => assignment.applicant_id === applicantId);
  const assignedIds = new Set(assigned.map((assignment) => assignment.grader_id));
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
      PAIR_REPEAT_PENALTY *
        [...assignedIds].reduce(
          (sum, coGraderId) => sum + (pairCounts.get(pairKey(coGraderId, grader.id)) ?? 0),
          0,
        ) +
      (loads.get(grader.id) ?? 0),
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

/**
 * Fills every empty slot on every applicant, one slot at a time.
 *
 * Greedy rather than exhaustive: `choosePartner` already scores a candidate
 * against everyone the applicant has so far, so adding graders one by one
 * handles a set of any arity and an applicant at any stage of filling, and
 * avoids enumerating every trio on a forty-person roster. Applicants are
 * shuffled so the order slots are filled in does not track the applicant list.
 */
export function planAssignments(
  applicants: Array<{ id: string }>,
  graders: AssignmentPlanGrader[],
  assignments: AssignmentPlanRow[],
  random: Random,
  gradersPerApplicant: number,
) {
  const inserts: AssignmentPlanRow[] = [];
  const current = [...assignments];
  const slots = assignmentSlots(gradersPerApplicant);
  let shortfall = 0;

  for (const applicant of shuffled(applicants, random)) {
    const filledSlots = new Set(
      current
        .filter((assignment) => assignment.applicant_id === applicant.id)
        .map((assignment) => assignment.slot),
    );
    const missingSlots = slots.filter((slot) => !filledSlots.has(slot));

    for (const [index, slot] of missingSlots.entries()) {
      const partner = choosePartner(graders, current, applicant.id, undefined, random);
      // Nobody eligible is left — every active grader is already on this
      // applicant. The remaining slots stay empty, and the deliberation view
      // reports the applicant as understaffed rather than the plan pretending.
      if (!partner) {
        shortfall += missingSlots.length - index;
        break;
      }
      const assignment = { set_id: "", applicant_id: applicant.id, grader_id: partner.id, slot };
      inserts.push(assignment);
      current.push(assignment);
    }
  }

  return { inserts, shortfall };
}
