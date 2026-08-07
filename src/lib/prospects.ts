import "server-only";
import { createHash } from "node:crypto";
import {
  deleteSavedProspect,
  insertSearchHistory,
  listRecentSearches,
  listSavedProspects,
  upsertSavedProspect,
} from "@/lib/store";
import type { Prospect, SavedProspect, SearchFilters, SearchHistoryItem } from "@/types";

export async function recordSearch(userId: string, filters: SearchFilters, resultCount: number): Promise<void> {
  await insertSearchHistory(userId, filters, resultCount);
}

export async function getRecentSearches(userId: string): Promise<SearchHistoryItem[]> {
  return listRecentSearches(userId);
}

export async function getSavedProspects(userId: string): Promise<SavedProspect[]> {
  return listSavedProspects(userId);
}

export async function saveProspect(userId: string, prospect: Prospect): Promise<SavedProspect> {
  const fingerprint = createHash("sha256")
    .update([prospect.companyName, prospect.firstName, prospect.lastName, prospect.street, prospect.houseNumber, prospect.zip, prospect.location].join("|"))
    .digest("hex");
  return upsertSavedProspect(userId, fingerprint, prospect);
}

export async function removeSavedProspect(userId: string, savedId: string): Promise<void> {
  await deleteSavedProspect(userId, savedId);
}
