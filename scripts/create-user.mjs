import { randomBytes, randomUUID, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";
import { get, put } from "@vercel/blob";

const scrypt = promisify(scryptCallback);
const [usernameArg, displayNameArg] = process.argv.slice(2);
const password = process.env.NEW_USER_PASSWORD ?? "";

if (!usernameArg || !displayNameArg) {
  console.error('Usage: NEW_USER_PASSWORD="…" npm run user:create -- <username> "Display name"');
  process.exit(1);
}

const username = usernameArg.trim().toLocaleLowerCase("fr-CH");
if (!/^[\p{L}\p{N}._@+-]{3,80}$/u.test(username)) {
  console.error("Le nom d’utilisateur doit contenir 3 à 80 caractères valides.");
  process.exit(1);
}

const policy = [
  [password.length >= 14, "14 caractères minimum"],
  [/[a-z]/.test(password), "une minuscule"],
  [/[A-Z]/.test(password), "une majuscule"],
  [/[0-9]/.test(password), "un chiffre"],
  [/[^A-Za-z0-9]/.test(password), "un caractère spécial"],
].filter(([valid]) => !valid).map(([, message]) => message);

if (policy.length) {
  console.error(`Mot de passe insuffisant: ${policy.join(", ")}.`);
  process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN) {
  console.error("BLOB_READ_WRITE_TOKEN est requis dans .env.local (vercel env pull .env.local).");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const passwordHash = `scrypt$32768$8$1$${salt.toString("hex")}$${hash.toString("hex")}`;

const USERS_PATH = "data/users.json";

const existingResult = await get(USERS_PATH, { access: "private" });
const users = existingResult && existingResult.statusCode === 200 ? JSON.parse(await new Response(existingResult.stream).text()) : [];
const etag = existingResult && existingResult.statusCode === 200 ? existingResult.blob.etag : null;

const existing = users.find((user) => user.username.toLocaleLowerCase("fr-CH") === username);
if (existing) {
  existing.display_name = displayNameArg.trim();
  existing.password_hash = passwordHash;
  existing.active = true;
} else {
  users.push({
    id: randomUUID(),
    username,
    display_name: displayNameArg.trim(),
    password_hash: passwordHash,
    active: true,
    created_at: new Date().toISOString(),
  });
}

await put(USERS_PATH, JSON.stringify(users), {
  access: "private",
  contentType: "application/json",
  addRandomSuffix: false,
  allowOverwrite: true,
  ...(etag ? { ifMatch: etag } : {}),
});

console.log(`Utilisateur « ${username} » créé ou mis à jour.`);
