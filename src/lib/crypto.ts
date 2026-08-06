import {
  createHash,
  createHmac,
  randomBytes,
  scrypt as scryptCallback,
  timingSafeEqual,
} from "node:crypto";

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const KEY_LENGTH = 64;
const MAX_MEMORY = 64 * 1024 * 1024;

function deriveKey(password: string, salt: Buffer, keyLength: number, options: { N: number; r: number; p: number; maxmem: number }): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scryptCallback(password, salt, keyLength, options, (error, derivedKey) => {
      if (error) reject(error);
      else resolve(derivedKey);
    });
  });
}

export const DUMMY_PASSWORD_HASH =
  "scrypt$32768$8$1$00000000000000000000000000000000$" + "00".repeat(KEY_LENGTH);

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const derived = await deriveKey(password, salt, KEY_LENGTH, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: MAX_MEMORY,
  });

  return [
    "scrypt",
    SCRYPT_N,
    SCRYPT_R,
    SCRYPT_P,
    salt.toString("hex"),
    derived.toString("hex"),
  ].join("$");
}

export async function verifyPassword(password: string, encoded: string): Promise<boolean> {
  try {
    const [algorithm, n, r, p, saltHex, hashHex] = encoded.split("$");
    if (algorithm !== "scrypt" || !n || !r || !p || !saltHex || !hashHex) return false;
    if (Number(n) !== SCRYPT_N || Number(r) !== SCRYPT_R || Number(p) !== SCRYPT_P) return false;
    if (!/^[0-9a-f]{32}$/i.test(saltHex) || !/^[0-9a-f]{128}$/i.test(hashHex)) return false;

    const expected = Buffer.from(hashHex, "hex");
    if (expected.length !== KEY_LENGTH) return false;

    const derived = await deriveKey(password, Buffer.from(saltHex, "hex"), expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: MAX_MEMORY,
    });

    return timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

export function hmacIdentifier(secret: string, type: "login" | "ip", value: string): string {
  return `${type}:${createHmac("sha256", secret).update(value).digest("hex")}`;
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

export function passwordPolicyErrors(password: string): string[] {
  const errors: string[] = [];
  if (password.length < 14) errors.push("14 caractères minimum");
  if (!/[a-z]/.test(password)) errors.push("une minuscule");
  if (!/[A-Z]/.test(password)) errors.push("une majuscule");
  if (!/[0-9]/.test(password)) errors.push("un chiffre");
  if (!/[^A-Za-z0-9]/.test(password)) errors.push("un caractère spécial");
  return errors;
}
