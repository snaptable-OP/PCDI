import "server-only";

/** Keys we presign are under uploads/{projectId}/… */
export function isValidXlsxUploadKey(key: string, projectId: string): boolean {
  const pid = projectId.trim();
  if (!pid) return false;
  const prefix = `uploads/${pid}/`;
  if (!key.startsWith(prefix)) return false;
  if (key.includes("..") || key.includes("//")) return false;
  return key.length <= 512;
}
