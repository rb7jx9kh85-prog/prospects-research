import { NextRequest, NextResponse } from "next/server";
import { createSession, SESSION_COOKIE } from "@/lib/auth";
import { DUMMY_PASSWORD_HASH, hmacIdentifier, verifyPassword } from "@/lib/crypto";
import { getServerEnv } from "@/lib/env";
import { assertSameOrigin, clientIp, jsonError } from "@/lib/request-security";
import { checkLoginAttempts, clearLoginAttempts, findUserByUsername, recordLoginFailure } from "@/lib/store";
import { isValidUsername, normalizeUsername } from "@/lib/validation";

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

  const currentGuard = await checkLoginAttempts(identifiers);
  if (!currentGuard.allowed) {
    return jsonError("Connexion temporairement verrouillée après 10 essais.", 429, {
      attemptsRemaining: 0,
      lockedUntil: currentGuard.lockedUntil,
    });
  }

  const user = await findUserByUsername(username);
  const passwordMatches = await verifyPassword(password, user?.password_hash ?? DUMMY_PASSWORD_HASH);

  if (!user?.active || !passwordMatches) {
    const state = await recordLoginFailure(identifiers);
    return jsonError(
      state.allowed ? "Nom d’utilisateur ou mot de passe incorrect." : "Connexion temporairement verrouillée après 10 essais.",
      state.allowed ? 401 : 429,
      { attemptsRemaining: state.attemptsRemaining, lockedUntil: state.lockedUntil },
    );
  }

  await clearLoginAttempts(identifiers);
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
