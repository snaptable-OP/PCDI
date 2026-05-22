import { NextRequest, NextResponse } from "next/server";
import { billieHandoffDisabledResponse } from "@/lib/billie/upstream-json";

export const runtime = "nodejs";
export const maxDuration = 120;

/** Vercel request body limit — only for fallback when browser → S3 PUT is blocked by CORS. */
const MAX_BYTES = 4 * 1024 * 1024;

function isHttpsUrl(s: string): boolean {
  try {
    const u = new URL(s);
    return u.protocol === "https:" || u.protocol === "http:";
  } catch {
    return false;
  }
}

/**
 * Server-side PUT to a presigned S3 URL (avoids browser CORS).
 * File still passes through this host — keep under ~4MB on Vercel.
 */
export async function POST(request: NextRequest) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return billieHandoffDisabledResponse();
  }

  let form: FormData;
  try {
    form = await request.formData();
  } catch {
    return NextResponse.json(
      { error: "Request body too large or invalid. Use direct S3 upload for files over 4MB (requires bucket CORS)." },
      { status: 413 },
    );
  }

  const file = form.get("file");
  const uploadUrlRaw = form.get("uploadUrl");
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing `file` field." }, { status: 400 });
  }
  const uploadUrl =
    typeof uploadUrlRaw === "string" ? uploadUrlRaw.trim() : "";
  if (!uploadUrl || !isHttpsUrl(uploadUrl)) {
    return NextResponse.json({ error: "Missing or invalid `uploadUrl`." }, { status: 400 });
  }

  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      {
        error: `File too large for server proxy (max ${MAX_BYTES / (1024 * 1024)}MB on Vercel). Ask AWS to add CORS on the reference-file bucket so the browser can PUT directly to S3.`,
      },
      { status: 413 },
    );
  }

  const contentType =
    file.type && file.type !== "application/octet-stream"
      ? file.type
      : file.name.toLowerCase().endsWith(".pdf")
        ? "application/pdf"
        : "application/octet-stream";

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
      {
        error: `Storage PUT failed (${putRes.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      },
      { status: 502 },
    );
  }

  return NextResponse.json({ ok: true });
}
