import type { MatchMode, ProspectKind, SearchFilters } from "@/types";

const CONTROL_CHARS = /[\u0000-\u001F\u007F]/g;

function cleanString(value: unknown, maxLength: number): string {
  return typeof value === "string" ? value.replace(CONTROL_CHARS, " ").trim().slice(0, maxLength) : "";
}

export function normalizeUsername(value: unknown): string {
  return cleanString(value, 80).toLocaleLowerCase("fr-CH");
}

export function isValidUsername(value: string): boolean {
  return /^[\p{L}\p{N}._@+-]{3,80}$/u.test(value);
}

export function parseSearchFilters(value: unknown): SearchFilters | null {
  if (!value || typeof value !== "object") return null;
  const body = value as Record<string, unknown>;
  const keyword = cleanString(body.keyword, 100);
  const location = cleanString(body.location, 80);
  const zip = cleanString(body.zip, 10);
  const matchMode = cleanString(body.matchMode, 1) as MatchMode;
  const kind = cleanString(body.kind, 20) as ProspectKind;

  if (keyword.length < 2) return null;
  if (zip && !/^\d{4}$/.test(zip)) return null;
  if (!["0", "1", "2", "3"].includes(matchMode)) return null;
  if (!["all", "company", "independent"].includes(kind)) return null;

  return { keyword, location, zip, matchMode, kind };
}

export function parseProspect(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = JSON.stringify(value);
  if (raw.length > 20_000) return null;
  return value as Record<string, unknown>;
}
