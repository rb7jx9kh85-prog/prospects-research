import "server-only";
import { getServerEnv } from "@/lib/env";
import { supabaseAuthHeaders } from "@/lib/supabase-auth";

type RequestOptions = {
  method?: "GET" | "POST" | "PATCH" | "DELETE";
  body?: unknown;
  prefer?: string;
};

export class DatabaseError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "DatabaseError";
  }
}

export async function supabaseRequest<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const env = getServerEnv();
  const response = await fetch(`${env.supabaseUrl}/rest/v1${path}`, {
    method: options.method ?? "GET",
    headers: {
      ...supabaseAuthHeaders(env.supabaseSecretKey),
      "Content-Type": "application/json",
      Accept: "application/json",
      ...(options.prefer ? { Prefer: options.prefer } : {}),
    },
    body: options.body === undefined ? undefined : JSON.stringify(options.body),
    cache: "no-store",
  });

  if (!response.ok) {
    const detail = await response.text();
    console.error("Supabase request failed", response.status, detail.slice(0, 500));
    throw new DatabaseError("La base de données est momentanément indisponible.", response.status);
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export async function rpc<T>(name: string, body: Record<string, unknown>): Promise<T> {
  return supabaseRequest<T>(`/rpc/${name}`, { method: "POST", body });
}
