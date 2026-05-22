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

export function xlsxS3CorsHelpMessage(fileSizeBytes: number): string {
  const mb = (fileSizeBytes / (1024 * 1024)).toFixed(1);
  const proxyHint =
    fileSizeBytes <= XLSX_SERVER_PROXY_MAX_BYTES
      ? " The app tried a small-file server fallback if applicable."
      : ` Your file is ${mb}MB — it must upload directly to S3 (enable bucket CORS); files over 4MB cannot pass through Vercel.`;
  return (
    "Could not upload directly to S3 (usually missing CORS on the defect-analysis bucket)." +
    proxyHint +
    " Ask AWS to allow PUT from https://pcdi-ui.vercel.app, https://*.vercel.app, and http://127.0.0.1:3333 on bucket " +
    "(AWS_S3_BUCKET, e.g. billie-defect-analysis). See docs/s3-cors-defect-analysis-bucket.md in the repo."
  );
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
  contentType: string,
  signal?: AbortSignal,
): Promise<{ ok: true } | { ok: false; error: string }> {
  const form = new FormData();
  form.append("file", file);
  form.append("uploadUrl", uploadUrl);
  form.append("contentType", contentType);
  const res = await fetch("/api/upload-xlsx/s3-put", { method: "POST", body: form, signal });
  const body = (await res.json().catch(() => ({}))) as { error?: string };
  if (!res.ok) {
    return { ok: false, error: body.error ?? `Server upload proxy failed (${res.status}).` };
  }
  return { ok: true };
}

/**
 * Browser → S3 presigned PUT → complete (mint GET URL). No .xlsx bytes through Vercel.
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

  const presignRes = await fetch("/api/upload-xlsx/presign", {
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
  const presignBody = (await presignRes.json().catch(() => ({}))) as {
    error?: string;
    uploadUrl?: string;
    fileUrl?: string;
    bucket?: string;
    key?: string;
    region?: string;
    contentType?: string;
    headerRow?: number;
  };
  if (!presignRes.ok) {
    return { ok: false, error: presignBody.error ?? "Could not get S3 upload URL." };
  }

  const uploadUrl = presignBody.uploadUrl?.trim();
  const bucket = presignBody.bucket?.trim();
  const key = presignBody.key?.trim();
  const region = presignBody.region?.trim();
  const contentType = presignBody.contentType?.trim();
  if (!uploadUrl || !bucket || !key || !region) {
    return { ok: false, error: "S3 presign response was incomplete." };
  }

  let putOk = false;
  let putError = "";
  let corsLikely = false;

  const barePut = await putToPresignedUrl(uploadUrl, file, undefined, signal);
  if (barePut.ok) {
    putOk = true;
  } else {
    putError = barePut.error;
    corsLikely = barePut.networkError;
    if (!barePut.networkError && contentType) {
      const typedPut = await putToPresignedUrl(uploadUrl, file, contentType, signal);
      if (typedPut.ok) {
        putOk = true;
      } else {
        putError = typedPut.error;
        corsLikely = typedPut.networkError;
      }
    }
  }

  if (!putOk) {
    if (corsLikely && file.size <= XLSX_SERVER_PROXY_MAX_BYTES && contentType) {
      const proxy = await putViaServerProxy(uploadUrl, file, contentType, signal);
      if (proxy.ok) {
        putOk = true;
      } else {
        return { ok: false, error: `${proxy.error} ${xlsxS3CorsHelpMessage(file.size)}` };
      }
    }
    if (!putOk) {
      return {
        ok: false,
        error: corsLikely ? xlsxS3CorsHelpMessage(file.size) : putError,
      };
    }
  }

  const completeRes = await fetch("/api/upload-xlsx/complete", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ projectId, bucket, key, region, headerRow }),
    signal,
  });
  const completeBody = (await completeRes.json().catch(() => ({}))) as {
    error?: string;
    fileUrl?: string;
    presignedUrlExpiresInSeconds?: number;
    headerRow?: number;
  };
  if (!completeRes.ok || !completeBody.fileUrl) {
    return {
      ok: false,
      error: completeBody.error ?? "Upload succeeded but could not create file download URL.",
    };
  }

  return {
    ok: true,
    data: {
      fileUrl: completeBody.fileUrl,
      headerRow: completeBody.headerRow ?? headerRow,
      presignedUrlExpiresInSeconds: completeBody.presignedUrlExpiresInSeconds ?? 0,
      bucket,
      key,
      region,
    },
  };
}
