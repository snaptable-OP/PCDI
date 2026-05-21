export const SITE_ACCESS_COOKIE = "pcdi_site_access";

const ACCESS_MARKER = "pcdi-site-access-v1";

export function getSiteAccessPassword(): string | undefined {
  const password = process.env.SITE_ACCESS_PASSWORD?.trim();
  return password || undefined;
}

/** When unset, the site is open (local dev without a gate). */
export function isSiteAccessRequired(): boolean {
  return Boolean(getSiteAccessPassword());
}

function signingSecret(): string {
  return (
    process.env.SITE_ACCESS_TOKEN_SECRET?.trim() ||
    getSiteAccessPassword() ||
    ""
  );
}

async function hmacBase64Url(secret: string, message: string): Promise<string> {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    enc.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, enc.encode(message));
  const bytes = new Uint8Array(sig);
  let binary = "";
  for (const b of bytes) binary += String.fromCharCode(b);
  return btoa(binary).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

export async function siteAccessToken(): Promise<string> {
  return hmacBase64Url(signingSecret(), ACCESS_MARKER);
}

function timingSafeEqualStrings(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

export async function verifySiteAccessCookie(
  value: string | undefined,
): Promise<boolean> {
  if (!isSiteAccessRequired()) return true;
  if (!value) return false;
  const expected = await siteAccessToken();
  return timingSafeEqualStrings(value, expected);
}

export function verifySiteAccessPassword(input: string): boolean {
  const password = getSiteAccessPassword();
  if (!password) return true;
  if (input.length !== password.length) return false;
  let diff = 0;
  for (let i = 0; i < password.length; i++) {
    diff |= input.charCodeAt(i) ^ password.charCodeAt(i);
  }
  return diff === 0;
}

export function siteAccessCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  };
}

export function clearSiteAccessCookieOptions(): {
  httpOnly: boolean;
  secure: boolean;
  sameSite: "lax";
  path: string;
  maxAge: number;
} {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  };
}
