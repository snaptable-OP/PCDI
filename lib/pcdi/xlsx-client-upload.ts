export const XLSX_UPLOAD_MAX_BYTES = 30 * 1024 * 1024;
export const XLSX_SERVER_PROXY_MAX_BYTES = 4 * 1024 * 1024;

export type XlsxS3UploadData = {
  fileUrl: string;
  headerRow: number;
  presignedUrlExpiresInSeconds: number;
  bucket: string;
  key: string;
  region: string;
};

function isXlsxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".xlsx") &&
    (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" ||
      file.type === "" ||
      file.type === "application/octet-stream" ||
      file.type === "application/zip")
  );
}

function isBrowserStorageNetworkError(msg: string): boolean {
  const m = msg.toLowerCase();
  return m === "failed to fetch" || m.includes("networkerror") || m.includes("load failed");
}

function isPayloadTooLargeResponse(status: number, error?: string): boolean {
  if (status === 413) return true;
  const blob = (error ?? "").toLowerCase();
  return blob.includes("payload_too_large") || blob.includes("entity too large");
}

export function xlsxS3CorsHelpMessage(fileSizeBytes: number): string {
  const mb = (fileSizeBytes / (1024 * 1024)).toFixed(1);
  const proxyHint =
    fileSizeBytes <= XLSX_SERVER_PROXY_MAX_BYTES
      ? " A server fallback may apply for small files only."
      : ` Your file is ${mb}MB — it must upload directly to S3 (enable bucket CORS); files over 4MB cannot pass through Vercel.`;
  return (
    "Could not upload directly to S3 (usually missing CORS on the defect-analysis bucket)." +
    proxyHint +
    " Ask AWS to allow PUT from https://pcdi-ui.vercel.app, https://*.vercel.app, and http://127.0.0.1:3333. " +
    "See docs/s3-cors-defect-analysis-bucket.md."
  );
}

type PresignResult =
  | {
      ok: true;
      uploadUrl: string;
      fileUrl: string;
      bucket: string;
      key: string;
      region: string;
      presignedUrlExpiresInSeconds: number;
    }
  | { ok: false; error: string; payloadTooLarge?: boolean };

/** Billie presigned URL (preferred on Vercel — no AWS env or file bytes on this app). */
async function fetchBillieXlsxPresign(
  file: File,
  signal?: AbortSignal,
): Promise<PresignResult> {
  const fileName = encodeURIComponent(file.name.trim() || "upload.xlsx");
  const res = await fetch(`/api/defect-files/presigned-url?fileName=${fileName}`, {
    cache: "no-store",
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    uploadUrl?: string;
    fileUrl?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: body.error ?? "Could not get presigned upload URL from the analysis server.",
      payloadTooLarge: isPayloadTooLargeResponse(res.status, body.error),
    };
  }
  const uploadUrl = body.uploadUrl?.trim();
  const fileUrl = body.fileUrl?.trim();
  if (!uploadUrl || !fileUrl) {
    return { ok: false, error: "Presigned upload URLs were missing from the analysis server." };
  }
  return {
    ok: true,
    uploadUrl,
    fileUrl,
    bucket: "",
    key: "",
    region: "",
    presignedUrlExpiresInSeconds: 0,
  };
}

/** Fallback when Billie presign unavailable — uses AWS env on this app. */
async function fetchAppAwsXlsxPresign(
  projectId: string,
  file: File,
  headerRow: number,
  signal?: AbortSignal,
): Promise<PresignResult> {
  const res = await fetch("/api/upload-xlsx/presign", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      fileName: file.name,
      fileSize: file.size,
      headerRow,
      mimeType: file.type || undefined,
    }),
    signal,
  });
  const body = (await res.json().catch(() => ({}))) as {
    error?: string;
    uploadUrl?: string;
    bucket?: string;
    key?: string;
    region?: string;
    contentType?: string;
  };
  if (!res.ok) {
    return {
      ok: false,
      error: body.error ?? "Could not get S3 upload URL (AWS presign).",
      payloadTooLarge: isPayloadTooLargeResponse(res.status, body.error),
    };
  }
  const uploadUrl = body.uploadUrl?.trim();
  const bucket = body.bucket?.trim() ?? "";
  const key = body.key?.trim() ?? "";
  const region = body.region?.trim() ?? "";
  if (!uploadUrl || !bucket || !key || !region) {
    return { ok: false, error: "AWS presign response was incomplete." };
  }
  return {
    ok: true,
    uploadUrl,
    fileUrl: "",
    bucket,
    key,
    region,
    presignedUrlExpiresInSeconds: 0,
  };
}

async function resolveFileUrlAfterPut(
  presign: Extract<PresignResult, { ok: true }>,
  projectId: string,
  headerRow: number,
  signal?: AbortSignal,
): Promise<{ ok: true; fileUrl: string } | { ok: false; error: string }> {
  if (presign.fileUrl) {
    return { ok: true, fileUrl: presign.fileUrl };
  }
  const completeRes = await fetch("/api/upload-xlsx/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId,
      bucket: presign.bucket,
      key: presign.key,
      region: presign.region,
      headerRow,
    }),
    signal,
  });
  const completeBody = (await completeRes.json().catch(() => ({}))) as {
    error?: string;
    fileUrl?: string;
  };
  if (!completeRes.ok || !completeBody.fileUrl) {
    return {
      ok: false,
      error: completeBody.error ?? "Upload succeeded but could not create file download URL.",
    };
  }
  return { ok: true, fileUrl: completeBody.fileUrl };
}

async function putToPresignedUrl(
  uploadUrl: string,
  file: File,
  contentType: string | undefined,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string; networkError: boolean }> {
  try {
    const putRes = await fetch(uploadUrl, {
      method: "PUT",
      body: file,
      headers: contentType ? { "Content-Type": contentType } : undefined,
      cache: "no-store",
      signal,
    });
    if (!putRes.ok) {
      const text = await putRes.text().catch(() => "");
      return {
        ok: false,
        networkError: false,
        error: `S3 upload failed (${putRes.status})${text ? `: ${text.slice(0, 200)}` : ""}`,
      };
    }
    return { ok: true };
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { ok: false, networkError: isBrowserStorageNetworkError(msg), error: msg };
  }
}

async function putViaServerProxy(
  uploadUrl: string,
  file: File,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("uploadUrl", uploadUrl);
  form.append(
    "contentType",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
  const res = await fetch("/api/upload-xlsx/s3-put", { method: "POST", body: form, signal });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    const payload = isPayloadTooLargeResponse(res.status, body.error);
    return {
      ok: false,
      error: payload
        ? "File is too large to upload through Vercel. Enable S3 CORS so the browser can PUT directly to storage, then hard-refresh this page."
        : (body.error ?? `Server upload proxy failed (${res.status}).`),
    };
  }
  return { ok: true };
}

/**
 * Presign (Billie) → browser PUT to S3 → resolve fileUrl. No .xlsx bytes through Vercel.
 */
export async function uploadXlsxToS3Direct(
  projectId: string,
  file: File,
  headerRow: number,
  signal?: AbortSignal,
): Promise<{ ok: true; data: XlsxS3UploadData } | { ok: false; error: string }> {
  if (!isXlsxFile(file)) {
    return { ok: false, error: "Please choose an Excel file (.xlsx)." };
  }
  if (file.size > XLSX_UPLOAD_MAX_BYTES) {
    return {
      ok: false,
      error: `File too large (max ${XLSX_UPLOAD_MAX_BYTES / (1024 * 1024)}MB).`,
    };
  }

  let presign = await fetchBillieXlsxPresign(file, signal);
  if (!presign.ok && !presign.payloadTooLarge) {
    const awsPresign = await fetchAppAwsXlsxPresign(projectId, file, headerRow, signal);
    if (awsPresign.ok) presign = awsPresign;
    else if (!presign.payloadTooLarge && !awsPresign.payloadTooLarge) {
      return { ok: false, error: presign.error };
    }
  }
  if (!presign.ok) {
    return {
      ok: false,
      error:
        presign.error ??
        "Upload failed. Hard-refresh this page (Cmd+Shift+R) so the app uses direct S3 upload, not the old Vercel upload route.",
    };
  }

  const contentType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  let putOk = false;
  let putError = "";
  let corsLikely = false;

  const barePut = await putToPresignedUrl(presign.uploadUrl, file, undefined, signal);
  if (barePut.ok) {
    putOk = true;
  } else {
    putError = barePut.error;
    corsLikely = barePut.networkError;
    if (!barePut.networkError) {
      const typedPut = await putToPresignedUrl(presign.uploadUrl, file, contentType, signal);
      if (typedPut.ok) putOk = true;
      else {
        putError = typedPut.error;
        corsLikely = typedPut.networkError;
      }
    }
  }

  if (!putOk) {
    if (corsLikely && file.size <= XLSX_SERVER_PROXY_MAX_BYTES) {
      const proxy = await putViaServerProxy(presign.uploadUrl, file, signal);
      if (proxy.ok) putOk = true;
      else return { ok: false, error: proxy.error };
    }
    if (!putOk) {
      return {
        ok: false,
        error: corsLikely ? xlsxS3CorsHelpMessage(file.size) : putError,
      };
    }
  }

  const resolved = await resolveFileUrlAfterPut(presign, projectId, headerRow, signal);
  if (!resolved.ok) {
    return { ok: false, error: resolved.error };
  }

  return {
    ok: true,
    data: {
      fileUrl: resolved.fileUrl,
      headerRow,
      presignedUrlExpiresInSeconds: presign.presignedUrlExpiresInSeconds,
      bucket: presign.bucket,
      key: presign.key,
      region: presign.region,
    },
  };
}
