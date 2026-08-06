import assert from "node:assert/strict";
import test from "node:test";
import { DUMMY_PASSWORD_HASH, hashPassword, hmacIdentifier, passwordPolicyErrors, verifyPassword } from "../src/lib/crypto.ts";

test("hashPassword produit un hash scrypt vérifiable et salé", async () => {
  const password = "Correct-Horse-7!Battery";
  const first = await hashPassword(password);
  const second = await hashPassword(password);
  assert.notEqual(first, second);
  assert.equal(await verifyPassword(password, first), true);
  assert.equal(await verifyPassword("wrong", first), false);
});

test("le hash factice suit le même chemin de calcul et échoue", async () => {
  assert.equal(await verifyPassword("anything", DUMMY_PASSWORD_HASH), false);
  assert.equal(await verifyPassword("anything", DUMMY_PASSWORD_HASH.replace("32768", "1048576")), false);
});

test("les identifiants de limitation sont stables et cloisonnés", () => {
  const secret = "a".repeat(32);
  assert.equal(hmacIdentifier(secret, "login", "alice"), hmacIdentifier(secret, "login", "alice"));
  assert.notEqual(hmacIdentifier(secret, "login", "alice"), hmacIdentifier(secret, "ip", "alice"));
});

test("la politique de mot de passe exige toutes les catégories", () => {
  assert.equal(passwordPolicyErrors("Correct-Horse-7!Battery").length, 0);
  assert.ok(passwordPolicyErrors("short").length >= 4);
});
