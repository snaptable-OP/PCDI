import { NextRequest, NextResponse } from "next/server";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Vercel body limit — fallback when browser → S3 PUT is blocked by CORS. */
const MAX_BYTES = 4 * 1024 * 1024;

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/** Server PUT to presigned URL (avoids browser CORS; not for large files on Vercel). */
export async function POST(request: NextRequest) {
  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request too large for server proxy. Enable S3 CORS for direct browser upload." },
      { status: 413 },
    );
  }

  const file = form.get("file");
  const uploadUrlRaw = form.get("uploadUrl");
  const contentTypeRaw = form.get("contentType");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` field." }, { status: 400 });
  }
  const uploadUrl = typeof uploadUrlRaw === "string" ? uploadUrlRaw.trim() : "";
  if (!uploadUrl || !isHttpsUrl(uploadUrl)) {
    return NextResponse.json({ error: "Missing or invalid `uploadUrl`." }, { status: 400 });
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { error: `File too large for server proxy (max ${MAX_BYTES / (1024 * 1024)}MB on Vercel).` },
      { status: 413 },
    );
  }

  const contentType =
    typeof contentTypeRaw === "string" && contentTypeRaw.trim()
      ? contentTypeRaw.trim()
      : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

  const body = Buffer.from(await file.arrayBuffer());
  let putRes: Response;
  try {
    putRes = await fetch(uploadUrl, {
      method: "PUT",
      body,
      headers: { "Content-Type": contentType },
      cache: "no-store",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: `Storage PUT failed: ${msg}` }, { status: 502 });
  }

  if (!putRes.ok) {
    const text = await putRes.text().catch(() => "");
    return NextResponse.json(
      { error: `Storage PUT failed (${putRes.status})${text ? `: ${text.slice(0, 200)}` : ""}` },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
