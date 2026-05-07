/** Browser/webpack often omit `default`; exceljs exposes `Workbook` on the namespace. */
export async function createExcelJsWorkbook(): Promise<{
  workbook: import("exceljs").Workbook;
}> {
  const mod = (await import("exceljs")) as unknown as {
    default?: { Workbook?: new () => import("exceljs").Workbook } & Record<string, unknown>;
    Workbook?: new () => import("exceljs").Workbook;
  };
  const root = mod.default ?? mod;
  const WorkbookCtor = (root as { Workbook?: new () => import("exceljs").Workbook }).Workbook;
  if (typeof WorkbookCtor !== "function") {
    throw new Error("ExcelJS Workbook constructor missing — check webpack/exceljs browser bundle.");
  }
  return { workbook: new WorkbookCtor() };
}
