"use server";

import { revalidatePath } from "next/cache";

import { signInAdmin, signOutAdmin } from "@/lib/admin-auth";
import { setGraderIdentity } from "@/lib/identity";

export async function loginAsAdmin(password: string) {
  await signInAdmin(password);
  revalidatePath("/", "layout");
}

export async function logoutAdmin() {
  await signOutAdmin();
  revalidatePath("/", "layout");
}

/** Leaving the admin workspace always clears the admin session first. */
export async function switchToGrader(graderId: string) {
  if (!graderId) throw new Error("Choose a grader.");
  await signOutAdmin();
  await setGraderIdentity(graderId);
  revalidatePath("/", "layout");
}
