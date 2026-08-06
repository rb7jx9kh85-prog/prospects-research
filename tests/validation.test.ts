import assert from "node:assert/strict";
import test from "node:test";
import { normalizeUsername, parseSearchFilters } from "../src/lib/validation.ts";

test("normalizeUsername nettoie et normalise", () => {
  assert.equal(normalizeUsername("  Alice@Example.CH "), "alice@example.ch");
});

test("parseSearchFilters accepte une recherche valide", () => {
  assert.deepEqual(parseSearchFilters({ keyword: "architecte", location: "Genève", zip: "1201", matchMode: "1", kind: "company" }), {
    keyword: "architecte", location: "Genève", zip: "1201", matchMode: "1", kind: "company",
  });
});

test("parseSearchFilters refuse les critères invalides", () => {
  assert.equal(parseSearchFilters({ keyword: "a", location: "", zip: "12", matchMode: "9", kind: "all" }), null);
});
