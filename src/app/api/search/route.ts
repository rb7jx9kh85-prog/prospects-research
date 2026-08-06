import { NextRequest } from "next/server";
import { requireApiUser } from "@/lib/auth";
import { MultisourceError, searchBusinesses } from "@/lib/multisource";
import { recordSearch } from "@/lib/prospects";
import { assertSameOrigin, jsonError } from "@/lib/request-security";
import { parseSearchFilters } from "@/lib/validation";

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

  const filters = parseSearchFilters(body);
  if (!filters) return jsonError("Vérifiez les critères de recherche.", 400);

  try {
    const results = await searchBusinesses(filters);
    await recordSearch(user.id, filters, results.data.length);
    return Response.json(results);
  } catch (error) {
    if (error instanceof MultisourceError) return jsonError(error.message, error.status === 429 ? 429 : 502);
    console.error("Search failed", error);
    return jsonError("La recherche n’a pas pu être effectuée.", 500);
  }
}
