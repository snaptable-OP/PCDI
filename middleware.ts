import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import {
  isSiteAccessRequired,
  SITE_ACCESS_COOKIE,
  verifySiteAccessCookie,
} from "@/lib/auth/site-access";

export async function middleware(request: NextRequest) {
  if (!isSiteAccessRequired()) {
    return NextResponse.next();
  }

  const { pathname } = request.nextUrl;

  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico"
  ) {
    return NextResponse.next();
  }

  const cookie = request.cookies.get(SITE_ACCESS_COOKIE)?.value;
  if (await verifySiteAccessCookie(cookie)) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const loginUrl = new URL("/login", request.url);
  if (pathname !== "/") {
    loginUrl.searchParams.set("from", pathname);
  }
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
