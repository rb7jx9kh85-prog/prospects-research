import { randomBytes, scrypt as scryptCallback } from "node:crypto";
import { promisify } from "node:util";

const scrypt = promisify(scryptCallback);
const [usernameArg, displayNameArg] = process.argv.slice(2);
const password = process.env.NEW_USER_PASSWORD ?? "";
const supabaseUrl = process.env.SUPABASE_URL?.replace(/\/$/, "");
const serviceKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

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
if (!supabaseUrl || !serviceKey) {
  console.error("SUPABASE_URL et SUPABASE_SECRET_KEY sont requis dans .env.local.");
  process.exit(1);
}

const salt = randomBytes(16);
const hash = await scrypt(password, salt, 64, { N: 32768, r: 8, p: 1, maxmem: 64 * 1024 * 1024 });
const passwordHash = `scrypt$32768$8$1$${salt.toString("hex")}$${hash.toString("hex")}`;

const response = await fetch(`${supabaseUrl}/rest/v1/app_users?on_conflict=username`, {
  method: "POST",
  headers: {
    apikey: serviceKey,
    ...(serviceKey.split(".").length === 3 ? { Authorization: `Bearer ${serviceKey}` } : {}),
    "Content-Type": "application/json",
    Prefer: "resolution=merge-duplicates,return=representation",
  },
  body: JSON.stringify({ username, display_name: displayNameArg.trim(), password_hash: passwordHash, active: true }),
});

if (!response.ok) {
  console.error(`Création refusée (${response.status}): ${(await response.text()).slice(0, 500)}`);
  process.exit(1);
}

console.log(`Utilisateur « ${username} » créé ou mis à jour.`);
