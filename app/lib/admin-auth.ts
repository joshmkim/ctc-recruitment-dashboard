import "server-only";

import {
  createHmac,
  timingSafeEqual,
} from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { getGraderId, GRADER_COOKIE } from "@/lib/identity";

const ADMIN_COOKIE = "ctc-admin";
const TOKEN_MESSAGE = "ctc-admin";

function tokenForPassword(password: string) {
  return createHmac("sha256", password).update(TOKEN_MESSAGE).digest("hex");
}

function password() {
  const value = process.env.ADMIN_PASSWORD;
  if (!value) throw new Error("Missing ADMIN_PASSWORD in .env.local.");
  return value;
}

export async function isAdmin() {
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!token) return false;

  const expected = Buffer.from(tokenForPassword(password()), "utf8");
  const received = Buffer.from(token, "utf8");
  return (
    expected.length === received.length &&
    timingSafeEqual(expected, received)
  );
}

export async function requireAdmin() {
  if (!(await isAdmin())) redirect("/enter");
}

/**
 * For reads open to the whole club rather than to admins alone.
 *
 * The grader cookie is unsigned and forgeable, so this is not access control —
 * it is the same bar the rest of the written app sets, applied where the read
 * happens rather than only at the edge in `proxy.ts`. Admins pass separately
 * because `signInAdmin()` deletes the grader cookie.
 *
 * It lives here, beside `requireAdmin()`, rather than in `lib/identity.ts`:
 * that module is imported by this one, and putting it there would make the two
 * circular.
 */
export async function requireIdentity() {
  if (await getGraderId()) return;
  if (await isAdmin()) return;
  redirect("/enter");
}

export async function signInAdmin(candidate: string) {
  const expected = Buffer.from(password(), "utf8");
  const received = Buffer.from(candidate, "utf8");
  const matches =
    expected.length === received.length && timingSafeEqual(expected, received);

  if (!matches) throw new Error("Incorrect admin password.");

  (await cookies()).set(ADMIN_COOKIE, tokenForPassword(password()), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
  // Admin is a role, not a grader identity. Do not carry a selected grader
  // into the admin workspace.
  (await cookies()).delete(GRADER_COOKIE);
}

export async function signOutAdmin() {
  (await cookies()).delete(ADMIN_COOKIE);
}
