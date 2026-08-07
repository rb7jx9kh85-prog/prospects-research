import "server-only";
import { BlobNotFoundError, BlobPreconditionFailedError, get, put } from "@vercel/blob";

async function readJson<T>(pathname: string, fallback: T): Promise<{ value: T; etag: string | null }> {
  const result = await get(pathname, { access: "private" });
  if (!result || result.statusCode !== 200) return { value: fallback, etag: null };
  const text = await new Response(result.stream).text();
  return { value: text ? (JSON.parse(text) as T) : fallback, etag: result.blob.etag };
}

async function writeJson<T>(pathname: string, value: T, etag: string | null): Promise<void> {
  await put(pathname, JSON.stringify(value), {
    access: "private",
    contentType: "application/json",
    addRandomSuffix: false,
    allowOverwrite: true,
    ...(etag ? { ifMatch: etag } : {}),
  });
}

/**
 * Read-modify-write against a single JSON blob, retrying on concurrent
 * writers. Fine for this app's traffic; not a substitute for a real database
 * under heavy write concurrency.
 */
export async function mutateCollection<T>(
  pathname: string,
  mutator: (items: T[]) => T[] | Promise<T[]>,
): Promise<T[]> {
  for (let attempt = 0; attempt < 5; attempt += 1) {
    const { value: items, etag } = await readJson<T[]>(pathname, []);
    const next = await mutator(items);
    try {
      await writeJson(pathname, next, etag);
      return next;
    } catch (error) {
      const isRace = error instanceof BlobPreconditionFailedError || error instanceof BlobNotFoundError;
      if (isRace && attempt < 4) continue;
      throw error;
    }
  }
  throw new Error("Impossible d’écrire les données après plusieurs tentatives.");
}

export async function readCollection<T>(pathname: string): Promise<T[]> {
  const { value } = await readJson<T[]>(pathname, []);
  return value;
}
