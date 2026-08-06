import type { Prospect } from "@/types";

const COLUMNS = ["Nom", "Type", "Catégorie", "E-mail", "Téléphone", "Rue", "NPA", "Localité", "Site web"];

function csvCell(value: unknown): string {
  const raw = String(value ?? "");
  // Prevent spreadsheet formula injection when the file is opened in Excel/Sheets.
  const spreadsheetSafe = /^[=+\-@]/.test(raw) ? `'${raw}` : raw;
  return `"${spreadsheetSafe.replaceAll('"', '""')}"`;
}

export function buildProspectsCsv(items: Prospect[]): string {
  const rows = items.map((item) => [
    item.companyName || [item.firstName, item.lastName].filter(Boolean).join(" "),
    item.companyName ? "Entreprise" : "Indépendant",
    typeof item.category === "string"
      ? item.category
      : item.category?.fr || item.category?.de || item.category?.it || item.category?.en || "",
    item.email,
    item.mobileNumbers[0] || item.phoneNumbers[0] || "",
    [item.street, item.houseNumber].filter(Boolean).join(" "),
    item.zip,
    item.location,
    item.url,
  ]);

  return `\uFEFF${[COLUMNS, ...rows].map((row) => row.map(csvCell).join(";")).join("\r\n")}`;
}

export function downloadProspectsCsv(items: Prospect[]): void {
  const csv = buildProspectsCsv(items);
  const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = `prospects-${new Date().toISOString().slice(0, 10)}.csv`;
  link.click();
  URL.revokeObjectURL(url);
}
