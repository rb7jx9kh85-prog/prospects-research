export function isLegacyJwtKey(key: string): boolean {
  return key.split(".").length === 3;
}

export function supabaseAuthHeaders(key: string): Record<string, string> {
  return {
    apikey: key,
    // New sb_secret_* keys authenticate through apikey. Legacy service_role JWTs
    // also need to be forwarded as the PostgREST bearer token.
    ...(isLegacyJwtKey(key) ? { Authorization: `Bearer ${key}` } : {}),
  };
}
