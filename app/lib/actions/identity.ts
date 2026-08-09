"use server";

import { revalidatePath } from "next/cache";

import { setGraderIdentity } from "@/lib/identity";

export async function chooseGrader(graderId: string) {
  if (!graderId) throw new Error("Choose a grader.");

  await setGraderIdentity(graderId);
  revalidatePath("/", "layout");
}
