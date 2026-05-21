import { NextResponse } from "next/server";
import {
  clearSiteAccessCookieOptions,
  SITE_ACCESS_COOKIE,
} from "@/lib/auth/site-access";

export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(SITE_ACCESS_COOKIE, "", clearSiteAccessCookieOptions());
  return res;
}
