export type OfficeOnlineEmbedOptions = {
  /**
   * A1-style cell reference (e.g. `A12`, `'Defects'!B4`). When set, Office embed may select that cell on load
   * so the viewport scrolls near that row (behaviour depends on host file / Microsoft viewer).
   */
  activeCell?: string;
};

/** Excel / Word / PPT online viewer — Microsoft fetches `fileUrl` server-side (works with S3 presigned GET). */
export function officeOnlineEmbedUrl(fileUrl: string, options?: OfficeOnlineEmbedOptions): string | null {
  try {
    const u = new URL(fileUrl);
    if (u.protocol !== "https:") return null;
    let out = `https://view.officeapps.live.com/op/embed.aspx?src=${encodeURIComponent(fileUrl)}`;
    const ac = options?.activeCell?.trim();
    if (ac) {
      out += `&ActiveCell=${encodeURIComponent(ac)}`;
    }
    return out;
  } catch {
    return null;
  }
}
