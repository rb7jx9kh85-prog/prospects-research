import { NextRequest, NextResponse } from "next/server";
import {
  createSession,
  findUserByUsername,
  SESSION_COOKIE,
} from "@/lib/auth";
import { DUMMY_PASSWORD_HASH, hmacIdentifier, verifyPassword } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import { assertSameOrigin, clientIp, jsonError } from "@/lib/request-security";
import { rpc } from "@/lib/supabase";
import { isValidUsername, normalizeUsername } from "@/lib/validation";

type GuardState = {
  allowed: boolean;
  attempts_remaining: number;
  locked_until: string | null;
};

async function guardState(identifiers: string[]): Promise<GuardState> {
  const rows = await rpc<GuardState[]>("check_login_attempts", { p_identifiers: identifiers });
  return rows[0] ?? { allowed: true, attempts_remaining: 10, locked_until: null };
}

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Requête refusée.", 403);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Données invalides.", 400);
  }

  const record = body && typeof body === "object" ? (body as Record<string, unknown>) : {};
  const username = normalizeUsername(record.username);
  const password = typeof record.password === "string" ? record.password : "";
  if (!isValidUsername(username) || !password || password.length > 256) return jsonError("Identifiants invalides.", 400);

  const { authSecret } = getServerEnv();
  const identifiers = [
    hmacIdentifier(authSecret, "login", username),
    hmacIdentifier(authSecret, "ip", clientIp(request)),
  ];

  const currentGuard = await guardState(identifiers);
  if (!currentGuard.allowed) {
    return jsonError("Connexion temporairement verrouillée après 10 essais.", 429, {
      attemptsRemaining: 0,
      lockedUntil: currentGuard.locked_until,
    });
  }

  const user = await findUserByUsername(username);
  const passwordMatches = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

  if (!user?.active || !passwordMatches) {
    const rows = await rpc<GuardState[]>("record_login_failure", { p_identifiers: identifiers });
    const state = rows[0] ?? { allowed: true, attempts_remaining: 9, locked_until: null };
    return jsonError(
      state.allowed ? "Nom d’utilisateur ou mot de passe incorrect." : "Connexion temporairement verrouillée après 10 essais.",
      state.allowed ? 401 : 429,
      { attemptsRemaining: state.attempts_remaining, lockedUntil: state.locked_until },
    );
  }

  await rpc("clear_login_attempts", { p_identifiers: identifiers });
  const { token, expiresAt } = await createSession(user.id, request.headers.get("user-agent") ?? "unknown");
  const response = NextResponse.json({ ok: true });
  response.cookies.set(SESSION_COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/",
    expires: expiresAt,
    priority: "high",
  });
  return response;
}
