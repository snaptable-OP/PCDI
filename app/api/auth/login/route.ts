import { NextResponse } from "next/server";
import {
  getSiteAccessPassword,
  isSiteAccessRequired,
  siteAccessCookieOptions,
  siteAccessToken,
  SITE_ACCESS_COOKIE,
  verifySiteAccessPassword,
} from "@/lib/auth/site-access";

export async function POST(request: Request) {
  if (!isSiteAccessRequired()) {
    return NextResponse.json({ ok: true, gateEnabled: false });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid request body" }, { status: 400 });
  }

  const password =
    body && typeof body === "object" && "password" in body
      ? String((body as { password: unknown }).password)
      : "";

  if (!password.trim()) {
    return NextResponse.json({ error: "Password is required" }, { status: 400 });
  }

  if (!verifySiteAccessPassword(password)) {
    return NextResponse.json({ error: "Incorrect password" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, gateEnabled: true });
  res.cookies.set(
    SITE_ACCESS_COOKIE,
    await siteAccessToken(),
    siteAccessCookieOptions(),
  );
  return res;
}

export async function GET() {
  return NextResponse.json({
    gateEnabled: isSiteAccessRequired(),
    configured: Boolean(getSiteAccessPassword()),
  });
}
