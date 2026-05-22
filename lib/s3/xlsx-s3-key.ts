import "server-only";

const MAX_KEY_FILENAME = 180;

export function sanitizeXlsxFileNameForKey(name: string): string {
  const base = name.split(/[/\\]/).pop() ?? "upload";
  return (
    base
      .replace(/[^\w.\-()+ ]/g, "_")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, MAX_KEY_FILENAME) || "upload.xlsx"
  );
}

export function buildXlsxS3Key(projectId: string, fileName: string): string {
  const safe = sanitizeXlsxFileNameForKey(fileName);
  return `uploads/${projectId.trim()}/${Date.now()}-${safe}`;
}

export function xlsxContentType(fileName: string, mimeType?: string): string {
  if (mimeType && mimeType !== "application/octet-stream") return mimeType;
  return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
}
