import { NextRequest } from "next/server";

export function assertSameOrigin(request: NextRequest): boolean {
  const origin = request.headers.get("origin");
  if (!origin) return false;

  try {
    const originUrl = new URL(origin);
    const forwardedHost = request.headers.get("x-forwarded-host");
    const host = forwardedHost ?? request.headers.get("host");
    return Boolean(host && originUrl.host === host);
  } catch {
    return false;
  }
}

export function clientIp(request: NextRequest): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const raw = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "unknown";
  return raw.slice(0, 128);
}

export function jsonError(message: string, status: number, extra?: Record<string, unknown>) {
  return Response.json({ error: message, ...extra }, { status });
}
