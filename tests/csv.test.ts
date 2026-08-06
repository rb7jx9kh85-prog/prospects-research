import assert from "node:assert/strict";
import test from "node:test";
import { buildProspectsCsv } from "../src/lib/csv.ts";
import type { Prospect } from "../src/types.ts";

const prospect: Prospect = {
  id: "p1",
  companyName: "Atelier Exemple SA",
  firstName: null,
  lastName: null,
  street: "Rue du Test",
  houseNumber: "4",
  zip: "1003",
  location: "Lausanne",
  category: { fr: "Architecture" },
  email: "contact@example.ch",
  url: "https://example.ch",
  phoneNumbers: ["021 000 00 00"],
  mobileNumbers: [],
};

test("l’export CSV contient les colonnes et les données attendues", () => {
  const csv = buildProspectsCsv([prospect]);
  assert.ok(csv.startsWith("\uFEFF"));
  assert.match(csv, /"Nom";"Type";"Catégorie"/);
  assert.match(csv, /"Atelier Exemple SA";"Entreprise";"Architecture"/);
  assert.match(csv, /"Rue du Test 4";"1003";"Lausanne"/);
});

test("l’export neutralise les formules de tableur", () => {
  const csv = buildProspectsCsv([{ ...prospect, companyName: "=HYPERLINK(\"bad\")" }]);
  assert.match(csv, /"'=HYPERLINK\(""bad""\)"/);
});
