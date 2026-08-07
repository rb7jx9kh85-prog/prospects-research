"use client";

import { FormEvent, useState } from "react";
import { downloadProspectsCsv } from "@/lib/csv";
import type { Prospect, SearchFilters } from "@/types";

const EMPTY_FILTERS: SearchFilters = { keyword: "", location: "", zip: "", matchMode: "1", kind: "all" };

export function SearchComponent() {
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<Prospect[] | null>(null);
  const [hitCount, setHitCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function runSearch(event?: FormEvent) {
    event?.preventDefault();
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const response = await fetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(filters),
      });
      const payload = (await response.json()) as { error?: string; data?: Prospect[]; hitCount?: number };
      if (!response.ok) throw new Error(payload.error ?? "Recherche impossible.");
      const data = payload.data ?? [];
      setResults(data);
      setHitCount(payload.hitCount ?? data.length);
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Recherche impossible.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  const displayResults = results ?? [];

  return (
    <div style={{ maxWidth: "1200px", margin: "0 auto", padding: "2rem" }}>
      <h1>Prospects Recherche</h1>

      <form onSubmit={runSearch} style={{ marginBottom: "2rem", padding: "1rem", border: "1px solid #ccc", borderRadius: "4px" }}>
        <div style={{ marginBottom: "1rem" }}>
          <label htmlFor="keyword">Mot-clé</label>
          <input
            id="keyword"
            type="text"
            placeholder="Activité, nom, etc."
            value={filters.keyword}
            onChange={(e) => setFilters({ ...filters, keyword: e.target.value })}
            style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.5rem", boxSizing: "border-box" }}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label htmlFor="location">Localité</label>
            <input
              id="location"
              type="text"
              placeholder="Zurich, Genève, etc."
              value={filters.location}
              onChange={(e) => setFilters({ ...filters, location: e.target.value })}
              style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.5rem", boxSizing: "border-box" }}
            />
          </div>

          <div>
            <label htmlFor="zip">NPA</label>
            <input
              id="zip"
              type="text"
              placeholder="8000"
              value={filters.zip}
              onChange={(e) => setFilters({ ...filters, zip: e.target.value })}
              style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.5rem", boxSizing: "border-box" }}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem", marginBottom: "1rem" }}>
          <div>
            <label htmlFor="matchMode">Correspondance</label>
            <select
              id="matchMode"
              value={filters.matchMode}
              onChange={(e) => setFilters({ ...filters, matchMode: e.target.value as SearchFilters["matchMode"] })}
              style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.5rem", boxSizing: "border-box" }}
            >
              <option value="0">Exacte</option>
              <option value="1">Large</option>
              <option value="2">Phonétique</option>
              <option value="3">Fuzzy</option>
            </select>
          </div>

          <div>
            <label htmlFor="kind">Type</label>
            <select
              id="kind"
              value={filters.kind}
              onChange={(e) => setFilters({ ...filters, kind: e.target.value as SearchFilters["kind"] })}
              style={{ display: "block", width: "100%", padding: "0.5rem", marginTop: "0.5rem", boxSizing: "border-box" }}
            >
              <option value="all">Tous</option>
              <option value="company">Entreprises</option>
              <option value="independent">Indépendants</option>
            </select>
          </div>
        </div>

        <button type="submit" disabled={loading} style={{ padding: "0.75rem 1.5rem", fontSize: "1rem", cursor: loading ? "not-allowed" : "pointer" }}>
          {loading ? "Recherche..." : "Rechercher"}
        </button>
      </form>

      {error && <div style={{ color: "red", marginBottom: "1rem" }}>Erreur : {error}</div>}

      {results !== null && (
        <div>
          <div style={{ marginBottom: "1rem" }}>
            <strong>Résultats : {hitCount}</strong>
            {displayResults.length > 0 && (
              <button
                onClick={() => downloadProspectsCsv(displayResults)}
                style={{ marginLeft: "1rem", padding: "0.5rem 1rem" }}
              >
                Exporter en CSV
              </button>
            )}
          </div>

          {displayResults.length === 0 ? (
            <p>Aucun résultat.</p>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ backgroundColor: "#f0f0f0" }}>
                  <th style={{ border: "1px solid #ccc", padding: "0.5rem" }}>Nom</th>
                  <th style={{ border: "1px solid #ccc", padding: "0.5rem" }}>Type</th>
                  <th style={{ border: "1px solid #ccc", padding: "0.5rem" }}>Catégorie</th>
                  <th style={{ border: "1px solid #ccc", padding: "0.5rem" }}>E-mail</th>
                  <th style={{ border: "1px solid #ccc", padding: "0.5rem" }}>Téléphone</th>
                  <th style={{ border: "1px solid #ccc", padding: "0.5rem" }}>Adresse</th>
                  <th style={{ border: "1px solid #ccc", padding: "0.5rem" }}>Site</th>
                </tr>
              </thead>
              <tbody>
                {displayResults.map((prospect) => {
                  const categoryStr = typeof prospect.category === "string"
                    ? prospect.category
                    : prospect.category?.fr || prospect.category?.de || prospect.category?.it || prospect.category?.en || "";
                  const phone = prospect.mobileNumbers[0] || prospect.phoneNumbers[0] || "";
                  return (
                    <tr key={prospect.id}>
                      <td style={{ border: "1px solid #ccc", padding: "0.5rem" }}>{prospect.companyName || `${prospect.firstName} ${prospect.lastName}`}</td>
                      <td style={{ border: "1px solid #ccc", padding: "0.5rem" }}>{prospect.companyName ? "Entreprise" : "Indépendant"}</td>
                      <td style={{ border: "1px solid #ccc", padding: "0.5rem" }}>{categoryStr}</td>
                      <td style={{ border: "1px solid #ccc", padding: "0.5rem" }}>
                        {prospect.email && <a href={`mailto:${prospect.email}`}>{prospect.email}</a>}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "0.5rem" }}>
                        {phone && <a href={`tel:${phone}`}>{phone}</a>}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "0.5rem" }}>
                        {prospect.street} {prospect.houseNumber}, {prospect.zip} {prospect.location}
                      </td>
                      <td style={{ border: "1px solid #ccc", padding: "0.5rem" }}>
                        {prospect.url && <a href={prospect.url} target="_blank" rel="noopener noreferrer">Lien</a>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}
