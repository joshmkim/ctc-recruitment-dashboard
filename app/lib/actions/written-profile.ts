"use server";

import { getWrittenProfile as loadWrittenProfile } from "@/lib/written-profile";

export async function getWrittenProfile(applicantId: string) {
  return loadWrittenProfile(applicantId);
}
