import { NextResponse } from "next/server";

export const runtime = "nodejs";

/**
 * Deprecated — sending .xlsx here hits Vercel FUNCTION_PAYLOAD_TOO_LARGE (~4.5MB).
 * Use: GET /api/defect-files/presigned-url → browser PUT to S3 → POST /api/save-excel-content
 */
export async function POST() {
  return NextResponse.json(
    {
      error:
        "This upload endpoint is disabled. Hard-refresh the page (Cmd+Shift+R). " +
        "Large .xlsx files upload directly to S3 via the analysis server presigned URL.",
      deprecated: true,
      useInstead: [
        "GET /api/defect-files/presigned-url?fileName=…",
        "PUT {uploadUrl} from the browser",
        "POST /api/save-excel-content",
      ],
    },
    { status: 410 },
  );
}
