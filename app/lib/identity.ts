import "server-only";

import { cookies } from "next/headers";

export const GRADER_COOKIE = "ctc-grader-id";

export async function getGraderId() {
  return (await cookies()).get(GRADER_COOKIE)?.value ?? null;
}

export async function setGraderIdentity(graderId: string) {
  (await cookies()).set(GRADER_COOKIE, graderId, {
    httpOnly: false,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearGraderIdentity() {
  (await cookies()).delete(GRADER_COOKIE);
}
