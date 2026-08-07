import "server-only";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionToken, sha256 } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import {
  createSessionRow,
  deleteSessionByTokenHash,
  findActiveSessionByTokenHash,
  findUserById,
} from "@/lib/store";

export const SESSION_COOKIE = process.env.NODE_ENV === "production" ? "__Host-prospect_session" : "prospect_session";

export type AuthUser = {
  id: string;
  username: string;
  displayName: string;
};

export async function createSession(userId: string, userAgent: string): Promise<{ token: string; expiresAt: Date }> {
  const { sessionTtlHours } = getServerEnv();
  const token = createSessionToken();
  const expiresAt = new Date(Date.now() + sessionTtlHours * 60 * 60 * 1000);

  await createSessionRow(userId, sha256(token), sha256(userAgent || "unknown"), expiresAt);

  return { token, expiresAt };
}

export async function deleteSession(token: string): Promise<void> {
  await deleteSessionByTokenHash(sha256(token));
}

export async function getCurrentUser(): Promise<AuthUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token || token.length > 100) return null;

  const session = await findActiveSessionByTokenHash(sha256(token));
  if (!session) return null;

  const user = await findUserById(session.user_id);
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
