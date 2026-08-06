import "server-only";
import { createHash } from "node:crypto";
import { supabaseRequest } from "@/lib/supabase";
import type { Prospect, SavedProspect, SearchFilters, SearchHistoryItem } from "@/types";

type HistoryRow = {
  id: string;
  keyword: string;
  location: string;
  zip: string;
  match_mode: SearchFilters["matchMode"];
  prospect_kind: SearchFilters["kind"];
  result_count: number;
  created_at: string;
};

type SavedRow = {
  id: string;
  prospect_data: Prospect;
  created_at: string;
};

export async function recordSearch(userId: string, filters: SearchFilters, resultCount: number): Promise<void> {
  await supabaseRequest("/prospect_searches", {
    method: "POST",
    body: {
      user_id: userId,
      keyword: filters.keyword,
      location: filters.location,
      zip: filters.zip,
      match_mode: filters.matchMode,
      prospect_kind: filters.kind,
      result_count: resultCount,
    },
  });
}

export async function getRecentSearches(userId: string): Promise<SearchHistoryItem[]> {
  const query = new URLSearchParams({
    select: "id,keyword,location,zip,match_mode,prospect_kind,result_count,created_at",
    user_id: `eq.${userId}`,
    order: "created_at.desc",
    limit: "8",
  });
  const rows = await supabaseRequest<HistoryRow[]>(`/prospect_searches?${query}`);
  return rows.map((row) => ({
    id: row.id,
    keyword: row.keyword,
    location: row.location,
    zip: row.zip,
    matchMode: row.match_mode,
    kind: row.prospect_kind,
    resultCount: row.result_count,
    createdAt: row.created_at,
  }));
}

export async function getSavedProspects(userId: string): Promise<SavedProspect[]> {
  const query = new URLSearchParams({
    select: "id,prospect_data,created_at",
    user_id: `eq.${userId}`,
    order: "created_at.desc",
    limit: "100",
  });
  const rows = await supabaseRequest<SavedRow[]>(`/saved_prospects?${query}`);
  return rows.map((row) => ({ ...row.prospect_data, savedId: row.id, savedAt: row.created_at }));
}

export async function saveProspect(userId: string, prospect: Prospect): Promise<SavedProspect> {
  const fingerprint = createHash("sha256")
    .update([prospect.companyName, prospect.firstName, prospect.lastName, prospect.street, prospect.houseNumber, prospect.zip, prospect.location].join("|"))
    .digest("hex");
  const rows = await supabaseRequest<SavedRow[]>("/saved_prospects?on_conflict=user_id,fingerprint", {
    method: "POST",
    prefer: "resolution=merge-duplicates,return=representation",
    body: { user_id: userId, fingerprint, prospect_data: prospect },
  });
  const row = rows[0];
  return { ...row.prospect_data, savedId: row.id, savedAt: row.created_at };
}

export async function removeSavedProspect(userId: string, savedId: string): Promise<void> {
  const query = new URLSearchParams({ id: `eq.${savedId}`, user_id: `eq.${userId}` });
  await supabaseRequest(`/saved_prospects?${query}`, { method: "DELETE" });
}
