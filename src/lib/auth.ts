import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, sha256 } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import { supabaseRequest } from "@/lib/supabase";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-prospect_session" : "prospect_session";

type UserRow = {
  id: string;
  username: string;
  display_name: string;
  password_hash: string;
  active: boolean;
};

type SessionRow = {
  id: string;
  user_id: string;
  expires_at: string;
};

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
};

export async function findUserByUsername(username: string): Promise<UserRow | null> {
  const query = new URLSearchParams({
    select: "id,username,display_name,password_hash,active",
    username: `eq.${username}`,
    limit: "1",
  });
  const rows = await supabaseRequest<UserRow[]>(`/app_users?${query}`);
  return rows[0] ?? null;
}

export async function createSession(userId: string, userAgent: string): Promise<{ token: string; expiresAt: Date }> {
  const { sessionTtlHours } = getServerEnv();
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);

  await supabaseRequest("/auth_sessions", {
    method: "POST",
    body: {
      user_id: userId,
      token_hash: sha256(token),
      user_agent_hash: sha256(userAgent || "unknown"),
      expires_at: expiresAt.toISOString(),
    },
  });

  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await supabaseRequest(`/auth_sessions?token_hash=eq.${sha256(token)}`, { method: "DELETE" });
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const sessionQuery = new URLSearchParams({
    select: "id,user_id,expires_at",
    token_hash: `eq.${sha256(token)}`,
    expires_at: `gt.${new Date().toISOString()}`,
    limit: "1",
  });
  const sessions = await supabaseRequest<SessionRow[]>(`/auth_sessions?${sessionQuery}`);
  const session = sessions[0];
  if (!session) return null;

  const userQuery = new URLSearchParams({
    select: "id,username,display_name,password_hash,active",
    id: `eq.${session.user_id}`,
    active: "eq.true",
    limit: "1",
  });
  const users = await supabaseRequest<UserRow[]>(`/app_users?${userQuery}`);
  const user = users[0];
  if (!user) return null;

  return { id: user.id, username: user.username, displayName: user.display_name };
}

export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

export async function requireApiUser(): Promise<AuthUser | null> {
  return getCurrentUser();
}

export async function currentUserAgent(): Promise<string> {
  const headerStore = await headers();
  return headerStore.get("user-agent") ?? "unknown";
}
