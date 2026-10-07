/**
 * Client-side CSV download with RFC 4180 quoting plus a guard against
 * spreadsheet formula injection: names are user-controlled, and a leading
 * =, +, - or @ would otherwise execute as a formula when the file is opened.
 *
 * Shared by the attendance reports page and the evacuation report detail.
 */
export function downloadCsv(
  headers: string[],
  rows: unknown[][],
  filename: string
): void {
  const csvCell = (value: unknown): string => {
    const raw = value == null ? "" : String(value);
    const guarded = /^[=+\-@\t\r]/.test(raw) ? `'${raw}` : raw;
    return /[",\r\n]/.test(guarded)
      ? `"${guarded.replace(/"/g, '""')}"`
      : guarded;
  };

  const csv = [
    headers.map(csvCell).join(","),
    ...rows.map((row) => row.map(csvCell).join(",")),
  ].join("\r\n");

  // BOM so Excel opens UTF-8 (BM names contain accented/UTF-8 characters)
  const blob = new Blob(["\uFEFF" + csv], {
    type: "text/csv;charset=utf-8;",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}
