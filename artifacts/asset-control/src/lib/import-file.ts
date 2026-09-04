import * as XLSX from "xlsx";

export const IMPORT_MAX_BYTES = 5 * 1024 * 1024;
export const IMPORT_MAX_ROWS = 2000;

export type SpreadsheetTable = {
  fileName: string;
  headers: string[];
  rows: Record<string, string>[];
  truncated: boolean;
};

export function toCsv(rows: string[][]) {
  return rows.map((row) => row.map((value) => `"${String(value).replaceAll('"', '""')}"`).join(",")).join("\n") + "\n";
}

export function downloadCsv(fileName: string, csv: string) {
  const url = URL.createObjectURL(new Blob([`\uFEFF${csv}`], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

function cellText(value: unknown): string {
  if (value == null) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return value.toISOString().slice(0, 10);
  }
  return String(value).trim();
}

export async function parseSpreadsheet(file: File): Promise<SpreadsheetTable> {
  if (file.size > IMPORT_MAX_BYTES) {
    throw new Error("The file must be 5 MB or smaller.");
  }
  const buffer = await file.arrayBuffer();
  const workbook = XLSX.read(buffer, { type: "array", cellDates: true });
  const sheetName = workbook.SheetNames[0];
  if (!sheetName) throw new Error("This workbook has no sheets.");
  const sheet = workbook.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, {
    defval: "",
    raw: false,
  });
  if (!raw.length) throw new Error("The file has a header row but no data rows.");
  const headers = Object.keys(raw[0]).map((header) => header.trim()).filter(Boolean);
  if (!headers.length) throw new Error("The file has no column headers.");
  const truncated = raw.length > IMPORT_MAX_ROWS;
  const rows = raw.slice(0, IMPORT_MAX_ROWS).map((record) => {
    const row: Record<string, string> = {};
    for (const header of headers) {
      row[header] = cellText(record[header]);
    }
    return row;
  });
  return { fileName: file.name, headers, rows, truncated };
}
