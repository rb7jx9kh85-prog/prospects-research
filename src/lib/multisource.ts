import "server-only";
import { createHash } from "node:crypto";
import { getServerEnv } from "@/lib/env";
import type { Category, Prospect, SearchFilters } from "@/types";

type RawAddress = {
  companyname?: unknown;
  firstname?: unknown;
  name?: unknown;
  street?: unknown;
  houseNumber?: unknown;
  zip?: unknown;
  location?: unknown;
  category?: unknown;
  email?: unknown;
  url?: unknown;
  phoneNumbers?: unknown;
  mobileNumbers?: unknown;
};

type RawResponse = {
  hitCount?: unknown;
  resultCount?: unknown;
  data?: unknown;
};

function text(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim().slice(0, 500) : null;
}

function textList(value: unknown): string[] {
  return Array.isArray(value) ? value.map(text).filter((item): item is string => Boolean(item)).slice(0, 10) : [];
}

function category(value: unknown): Category | string | null {
  if (typeof value === "string") return text(value);
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const raw = value as Record<string, unknown>;
  return { de: text(raw.de) ?? undefined, fr: text(raw.fr) ?? undefined, it: text(raw.it) ?? undefined, en: text(raw.en) ?? undefined };
}

function normalize(item: RawAddress): Prospect {
  const fingerprint = [item.companyname, item.firstname, item.name, item.street, item.houseNumber, item.zip, item.location]
    .map((part) => text(part) ?? "")
    .join("|");

  return {
    id: createHash("sha256").update(fingerprint).digest("hex").slice(0, 24),
    companyName: text(item.companyname),
    firstName: text(item.firstname),
    lastName: text(item.name),
    street: text(item.street),
    houseNumber: text(item.houseNumber),
    zip: text(item.zip),
    location: text(item.location),
    category: category(item.category),
    email: text(item.email),
    url: text(item.url),
    phoneNumbers: textList(item.phoneNumbers),
    mobileNumbers: textList(item.mobileNumbers),
  };
}

export class MultisourceError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
  }
}

export async function searchBusinesses(filters: SearchFilters): Promise<{ hitCount: number; data: Prospect[] }> {
  const env = getServerEnv();
  const value = [filters.keyword, filters.zip, filters.location].filter(Boolean).join(" ");
  const params = new URLSearchParams({ source: "business", value, type: filters.matchMode });

  const response = await fetch(`${env.multisourceApiUrl}/Search/AutoComplete?${params}`, {
    headers: { "Auth-Key": env.multisourceApiKey, Accept: "application/json" },
    cache: "no-store",
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    console.error("Multisource request failed", response.status);
    throw new MultisourceError(
      response.status === 401 || response.status === 403
        ? "La clé de l’annuaire n’est pas autorisée."
        : "L’annuaire suisse ne répond pas pour le moment.",
      response.status,
    );
  }

  const payload = (await response.json()) as RawResponse;
  const rawData = Array.isArray(payload.data) ? (payload.data as RawAddress[]) : [];
  let data = rawData.map(normalize);

  if (filters.kind === "company") data = data.filter((item) => Boolean(item.companyName));
  if (filters.kind === "independent") data = data.filter((item) => !item.companyName && Boolean(item.firstName || item.lastName));

  return {
    hitCount: typeof payload.hitCount === "number" ? payload.hitCount : data.length,
    data,
  };
}
