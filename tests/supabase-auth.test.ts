import assert from "node:assert/strict";
import test from "node:test";
import { supabaseAuthHeaders } from "../src/lib/supabase-auth.ts";

test("une clé Supabase moderne reste uniquement dans apikey", () => {
  assert.deepEqual(supabaseAuthHeaders("sb_secret_example"), { apikey: "sb_secret_example" });
});

test("une clé service_role JWT legacy est aussi envoyée comme bearer", () => {
  const key = "header.payload.signature";
  assert.deepEqual(supabaseAuthHeaders(key), { apikey: key, Authorization: `Bearer ${key}` });
});
