import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { removeSavedProspect, saveProspect } from "@/lib/prospects";
import { assertSameOrigin, jsonError } from "@/lib/request-security";
import { parseProspect } from "@/lib/validation";
import type { Prospect } from "@/types";

export async function POST(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Requête refusée.", 403);
  const user = await requireApiUser();
  if (!user) return jsonError("Votre session a expiré.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Données invalides.", 400);
  }
  const prospect = parseProspect(body);
  if (!prospect || typeof prospect.id !== "string") return jsonError("Prospect invalide.", 400);

  const saved = await saveProspect(user.id, prospect as Prospect);
  return Response.json(saved, { status: 201 });
}

export async function DELETE(request: NextRequest) {
  if (!assertSameOrigin(request)) return jsonError("Requête refusée.", 403);
  const user = await requireApiUser();
  if (!user) return jsonError("Votre session a expiré.", 401);

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return jsonError("Données invalides.", 400);
  }
  const savedId = body && typeof body === "object" ? (body as Record<string, unknown>).savedId : null;
  if (typeof savedId !== "string" || !/^[0-9a-f-]{36}$/i.test(savedId)) return jsonError("Prospect invalide.", 400);

  await removeSavedProspect(user.id, savedId);
  return new Response(null, { status: 204 });
}
