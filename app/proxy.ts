import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";

const GRADER_COOKIE = "ctc-grader-id";
const ADMIN_COOKIE = "ctc-admin";

export function proxy(request: NextRequest) {
  const pathname = request.nextUrl.pathname;
  if (pathname === "/enter") return NextResponse.next();

  const hasIdentity =
    request.cookies.has(GRADER_COOKIE) || request.cookies.has(ADMIN_COOKIE);

  if (!hasIdentity) {
    return NextResponse.redirect(new URL("/enter", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!_next|favicon.ico).*)"],
};
