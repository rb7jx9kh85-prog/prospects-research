import "server-only";
import { randomUUID } from "node:crypto";
import { mutateCollection, readCollection } from "@/lib/blob-store";
import type { Prospect, SavedProspect, SearchFilters, SearchHistoryItem } from "@/types";

const USERS_PATH = "data/users.json";
const SESSIONS_PATH = "data/sessions.json";
const LOGIN_ATTEMPTS_PATH = "data/login-attempts.json";
const SEARCH_HISTORY_PATH = "data/search-history.json";
const SAVED_PROSPECTS_PATH = "data/saved-prospects.json";

const LOCKOUT_WINDOW_MS = 30 * 60 * 1000;
const MAX_FAILURES = 10;

export type UserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  active: boolean;
  created_at: string;
};

type SessionRow = {
  id: string;
  user_id: string;
  token_hash: string;
  user_agent_hash: string;
  expires_at: string;
  created_at: string;
};

type LoginAttemptRow = {
  identifier: string;
  failures: number;
  window_started_at: string;
  locked_until: string | null;
  updated_at: string;
};

type SearchHistoryRow = {
  id: string;
  user_id: string;
  keyword: string;
  location: string;
  zip: string;
  match_mode: SearchFilters["matchMode"];
  prospect_kind: SearchFilters["kind"];
  result_count: number;
  created_at: string;
};

type SavedProspectRow = {
  id: string;
  user_id: string;
  fingerprint: string;
  prospect_data: Prospect;
  created_at: string;
};

export type GuardState = {
  allowed: boolean;
  attemptsRemaining: number;
  lockedUntil: string | null;
};

// --- Users -----------------------------------------------------------------

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const users = await readCollection<UserRow>(USERS_PATH);
  return users.find((user) => user.username.toLocaleLowerCase("fr-CH") === username.toLocaleLowerCase("fr-CH")) ?? null;
}

export async function upsertUser(input: { username: string; displayName: string; passwordHash: string }): Promise<UserRow> {
  const normalized = input.username.toLocaleLowerCase("fr-CH");
  const users = await mutateCollection<UserRow>(USERS_PATH, (rows) => {
    const existing = rows.find((user) => user.username.toLocaleLowerCase("fr-CH") === normalized);
    if (existing) {
      existing.display_name = input.displayName;
      existing.password_hash = input.passwordHash;
      existing.active = true;
      return rows;
    }
    rows.push({
      id: randomUUID(),
      username: input.username,
      display_name: input.displayName,
      password_hash: input.passwordHash,
      active: true,
      created_at: new Date().toISOString(),
    });
    return rows;
  });
  return users.find((user) => user.username.toLocaleLowerCase("fr-CH") === normalized)!;
}

// --- Sessions ----------------------------------------------------------------

export async function createSessionRow(userId: string, tokenHash: string, userAgentHash: string, expiresAt: Date): Promise<void> {
  await mutateCollection<SessionRow>(SESSIONS_PATH, (sessions) => {
    const fresh = sessions.filter((session) => new Date(session.expires_at) > new Date());
    fresh.push({
      id: randomUUID(),
      user_id: userId,
      token_hash: tokenHash,
      user_agent_hash: userAgentHash,
      expires_at: expiresAt.toISOString(),
      created_at: new Date().toISOString(),
    });
    return fresh;
  });
}

export async function deleteSessionByTokenHash(tokenHash: string): Promise<void> {
  await mutateCollection<SessionRow>(SESSIONS_PATH, (sessions) => sessions.filter((session) => session.token_hash !== tokenHash));
}

export async function findActiveSessionByTokenHash(tokenHash: string): Promise<SessionRow | null> {
  const sessions = await readCollection<SessionRow>(SESSIONS_PATH);
  const session = sessions.find((row) => row.token_hash === tokenHash);
  if (!session || new Date(session.expires_at) <= new Date()) return null;
  return session;
}

export async function findUserById(userId: string): Promise<UserRow | null> {
  const users = await readCollection<UserRow>(USERS_PATH);
  return users.find((user) => user.id === userId && user.active) ?? null;
}

// --- Login attempts ----------------------------------------------------------

function evaluateGuard(rows: LoginAttemptRow[], identifiers: string[]): GuardState {
  const now = Date.now();
  const relevant = rows.filter((row) => identifiers.includes(row.identifier));
  if (relevant.length === 0) return { allowed: true, attemptsRemaining: MAX_FAILURES, lockedUntil: null };

  let allowed = true;
  let attemptsRemaining = MAX_FAILURES;
  let lockedUntil: string | null = null;

  for (const row of relevant) {
    const windowExpired = now - new Date(row.window_started_at).getTime() > LOCKOUT_WINDOW_MS;
    const isLocked = row.locked_until !== null && new Date(row.locked_until).getTime() > now;
    if (isLocked || (!windowExpired && row.failures >= MAX_FAILURES)) allowed = false;
    const remaining = windowExpired ? MAX_FAILURES : Math.max(0, MAX_FAILURES - row.failures);
    attemptsRemaining = Math.min(attemptsRemaining, remaining);
    if (isLocked && (!lockedUntil || new Date(row.locked_until!) > new Date(lockedUntil))) lockedUntil = row.locked_until;
  }

  return { allowed, attemptsRemaining, lockedUntil };
}

export async function checkLoginAttempts(identifiers: string[]): Promise<GuardState> {
  const rows = await readCollection<LoginAttemptRow>(LOGIN_ATTEMPTS_PATH);
  return evaluateGuard(rows, identifiers);
}

export async function recordLoginFailure(identifiers: string[]): Promise<GuardState> {
  const rows = await mutateCollection<LoginAttemptRow>(LOGIN_ATTEMPTS_PATH, (attempts) => {
    const now = new Date();
    for (const identifier of identifiers) {
      if (!identifier || identifier.length < 10) continue;
      const existing = attempts.find((row) => row.identifier === identifier);
      if (!existing) {
        attempts.push({ identifier, failures: 1, window_started_at: now.toISOString(), locked_until: null, updated_at: now.toISOString() });
        continue;
      }
      const windowExpired = now.getTime() - new Date(existing.window_started_at).getTime() > LOCKOUT_WINDOW_MS;
      if (windowExpired) {
        existing.failures = 1;
        existing.window_started_at = now.toISOString();
        existing.locked_until = null;
      } else {
        existing.failures = Math.min(MAX_FAILURES, existing.failures + 1);
        if (existing.failures >= MAX_FAILURES) existing.locked_until = new Date(now.getTime() + LOCKOUT_WINDOW_MS).toISOString();
      }
      existing.updated_at = now.toISOString();
    }
    return attempts;
  });
  return evaluateGuard(rows, identifiers);
}

export async function clearLoginAttempts(identifiers: string[]): Promise<void> {
  await mutateCollection<LoginAttemptRow>(LOGIN_ATTEMPTS_PATH, (attempts) =>
    attempts.filter((row) => !identifiers.includes(row.identifier)),
  );
}

// --- Search history ------------------------------------------------------------

export async function insertSearchHistory(userId: string, filters: SearchFilters, resultCount: number): Promise<void> {
  await mutateCollection<SearchHistoryRow>(SEARCH_HISTORY_PATH, (rows) => {
    rows.push({
      id: randomUUID(),
      user_id: userId,
      keyword: filters.keyword,
      location: filters.location,
      zip: filters.zip,
      match_mode: filters.matchMode,
      prospect_kind: filters.kind,
      result_count: resultCount,
      created_at: new Date().toISOString(),
    });
    return rows;
  });
}

export async function listRecentSearches(userId: string): Promise<SearchHistoryItem[]> {
  const rows = await readCollection<SearchHistoryRow>(SEARCH_HISTORY_PATH);
  return rows
    .filter((row) => row.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8)
    .map((row) => ({
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

// --- Saved prospects -------------------------------------------------------------

export async function listSavedProspects(userId: string): Promise<SavedProspect[]> {
  const rows = await readCollection<SavedProspectRow>(SAVED_PROSPECTS_PATH);
  return rows
    .filter((row) => row.user_id === userId)
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 100)
    .map((row) => ({ ...row.prospect_data, savedId: row.id, savedAt: row.created_at }));
}

export async function upsertSavedProspect(userId: string, fingerprint: string, prospect: Prospect): Promise<SavedProspect> {
  const rows = await mutateCollection<SavedProspectRow>(SAVED_PROSPECTS_PATH, (saved) => {
    const existing = saved.find((row) => row.user_id === userId && row.fingerprint === fingerprint);
    if (existing) {
      existing.prospect_data = prospect;
      return saved;
    }
    saved.push({ id: randomUUID(), user_id: userId, fingerprint, prospect_data: prospect, created_at: new Date().toISOString() });
    return saved;
  });
  const row = rows.find((entry) => entry.user_id === userId && entry.fingerprint === fingerprint)!;
  return { ...row.prospect_data, savedId: row.id, savedAt: row.created_at };
}

export async function deleteSavedProspect(userId: string, savedId: string): Promise<void> {
  await mutateCollection<SavedProspectRow>(SAVED_PROSPECTS_PATH, (saved) =>
    saved.filter((row) => !(row.id === savedId && row.user_id === userId)),
  );
}
