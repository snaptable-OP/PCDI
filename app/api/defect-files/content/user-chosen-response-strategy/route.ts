import { NextRequest, NextResponse } from "next/server";
import { upstreamFetchFailedResponse } from "@/lib/billie/upstream-fetch-error";
import { getBillieBase } from "@/lib/billie/upstream-json";

export const runtime = "nodejs";
export const maxDuration = 60;
const UPSTREAM_PATH = "/api/defect-files/content/user-chosen-response-strategy";

type Body = {
  defectFileId?: string;
  itemIds?: string[];
  userChosenResponseStrategy?: string;
};

/**
 * Proxies PUT /api/defect-files/content/user-chosen-response-strategy (Billie batch strategy update).
 */
export async function PUT(request: NextRequest) {
  if (process.env.BILLIE_SKIP_BACKEND_HANDOFF === "1") {
    return NextResponse.json({ ok: true, skipped: true as const });
  }

  let json: Body;
  try {
    json = (await request.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const defectFileId = typeof json.defectFileId === "string" ? json.defectFileId.trim() : "";
  if (!defectFileId) {
    return NextResponse.json({ error: "defectFileId is required" }, { status: 400 });
  }
  const itemIds = Array.isArray(json.itemIds) ? json.itemIds.filter((x) => typeof x === "string" && x.trim()) : [];
  if (itemIds.length === 0) {
    return NextResponse.json({ error: "itemIds must be a non-empty array" }, { status: 400 });
  }
  const userChosenResponseStrategy =
    typeof json.userChosenResponseStrategy === "string" ? json.userChosenResponseStrategy : "";
  if (!userChosenResponseStrategy.trim()) {
    return NextResponse.json({ error: "userChosenResponseStrategy is required" }, { status: 400 });
  }

  const base = getBillieBase();
  const url = `${base}${UPSTREAM_PATH}`;

  const headers: Record<string, string> = { "Content-Type": "application/json" };
  const token = process.env.BILLIE_API_KEY;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  let res: Response;
  try {
    res = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        defectFileId,
        itemIds,
        userChosenResponseStrategy: userChosenResponseStrategy.trim(),
      }),
    });
  } catch (e) {
    return upstreamFetchFailedResponse("user-chosen-response-strategy", e);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text) as unknown;
    } catch {
      data = { raw: text };
    }
  }

  if (!res.ok) {
    const msg =
      typeof data === "object" &&
      data !== null &&
      "message" in data &&
      typeof (data as { message: unknown }).message === "string"
        ? (data as { message: string }).message
        : `Analysis server returned ${res.status}`;
    return NextResponse.json({ error: msg, status: res.status, detail: data }, { status: 502 });
  }

  return NextResponse.json(data ?? { ok: true });
}
