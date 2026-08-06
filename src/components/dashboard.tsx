"use client";

import { FormEvent, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { AuthUser } from "@/lib/auth";
import { downloadProspectsCsv } from "@/lib/csv";
import type { Prospect, SavedProspect, SearchFilters, SearchHistoryItem } from "@/types";

const EMPTY_FILTERS: SearchFilters = { keyword: "", location: "", zip: "", matchMode: "1", kind: "all" };

type Props = {
  user: AuthUser;
  initialHistory: SearchHistoryItem[];
  initialSaved: SavedProspect[];
};

export function Dashboard({ user, initialHistory, initialSaved }: Props) {
  const router = useRouter();
  const [tab, setTab] = useState<"search" | "saved">("search");
  const [filters, setFilters] = useState<SearchFilters>(EMPTY_FILTERS);
  const [results, setResults] = useState<Prospect[] | null>(null);
  const [hitCount, setHitCount] = useState(0);
  const [history, setHistory] = useState(initialHistory);
  const [saved, setSaved] = useState(initialSaved);
  const [savingIds, setSavingIds] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const savedByProspectId = useMemo(() => new Map(saved.map((item) => [item.id, item.savedId])), [saved]);

  async function apiFetch(url: string, init: RequestInit) {
    const response = await fetch(url, init);
    if (response.status === 401) {
      router.replace("/login");
      router.refresh();
    }
    return response;
  }

  async function runSearch(event?: FormEvent, override?: SearchFilters) {
    event?.preventDefault();
    const next = override ?? filters;
    setLoading(true);
    setError("");
    setResults(null);
    try {
      const response = await apiFetch("/api/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      const payload = (await response.json()) as { error?: string; data?: Prospect[]; hitCount?: number };
      if (!response.ok) throw new Error(payload.error ?? "Recherche impossible.");
      const data = payload.data ?? [];
      setResults(data);
      setHitCount(payload.hitCount ?? data.length);
      setHistory((current) => [
        { ...next, id: crypto.randomUUID(), resultCount: data.length, createdAt: new Date().toISOString() },
        ...current,
      ].slice(0, 8));
    } catch (searchError) {
      setError(searchError instanceof Error ? searchError.message : "Recherche impossible.");
      setResults([]);
    } finally {
      setLoading(false);
    }
  }

  async function toggleSaved(prospect: Prospect) {
    if (savingIds.includes(prospect.id)) return;
    setSavingIds((ids) => [...ids, prospect.id]);
    setError("");
    try {
      const savedId = savedByProspectId.get(prospect.id);
      if (savedId) {
        const response = await apiFetch("/api/saved", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ savedId }),
        });
        if (!response.ok) throw new Error("Impossible de retirer ce prospect.");
        setSaved((items) => items.filter((item) => item.savedId !== savedId));
      } else {
        const response = await apiFetch("/api/saved", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(prospect),
        });
        const payload = (await response.json()) as SavedProspect & { error?: string };
        if (!response.ok) throw new Error(payload.error ?? "Impossible d’enregistrer ce prospect.");
        setSaved((items) => [payload, ...items.filter((item) => item.id !== payload.id)]);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Action impossible.");
    } finally {
      setSavingIds((ids) => ids.filter((id) => id !== prospect.id));
    }
  }

  async function logout() {
    await apiFetch("/api/auth/logout", { method: "POST" });
    router.replace("/login");
    router.refresh();
  }

  function replay(item: SearchHistoryItem) {
    const next = { keyword: item.keyword, location: item.location, zip: item.zip, matchMode: item.matchMode, kind: item.kind };
    setFilters(next);
    setTab("search");
    void runSearch(undefined, next);
  }

  const visibleProspects = tab === "saved" ? saved : results;

  return (
    <main className="app-shell">
      <header className="app-header">
        <a className="app-brand" href="/dashboard" aria-label="Piste, accueil">
          <span className="brand-mark brand-mark-small" aria-hidden="true"><span /><span /></span>
          <span>Piste</span>
        </a>
        <nav className="main-tabs" aria-label="Navigation principale">
          <button className={tab === "search" ? "active" : ""} onClick={() => setTab("search")}><SearchIcon />Recherche</button>
          <button className={tab === "saved" ? "active" : ""} onClick={() => setTab("saved")}><BookmarkIcon />Sélection <span className="count-pill">{saved.length}</span></button>
        </nav>
        <div className="user-menu">
          <span className="avatar" aria-hidden="true">{initials(user.displayName)}</span>
          <span className="user-name">{user.displayName}</span>
          <button className="icon-button" onClick={logout} title="Se déconnecter" aria-label="Se déconnecter"><LogoutIcon /></button>
        </div>
      </header>

      {tab === "search" ? (
        <div className="workspace">
          <aside className="search-sidebar">
            <div className="sidebar-heading">
              <p className="eyebrow">Nouvelle recherche</p>
              <h1>Trouver des prospects</h1>
              <p>Combinez une activité et une zone géographique.</p>
            </div>
            <form className="filter-form" onSubmit={runSearch}>
              <label>
                <span>Activité ou nom <b aria-hidden="true">*</b></span>
                <div className="input-with-icon"><SearchIcon /><input value={filters.keyword} onChange={(e) => setFilters({ ...filters, keyword: e.target.value })} placeholder="Ex. architecte, menuiserie…" minLength={2} maxLength={100} required /></div>
              </label>
              <div className="two-columns">
                <label>
                  <span>Localité</span>
                  <input value={filters.location} onChange={(e) => setFilters({ ...filters, location: e.target.value })} placeholder="Lausanne" maxLength={80} />
                </label>
                <label>
                  <span>NPA</span>
                  <input value={filters.zip} onChange={(e) => setFilters({ ...filters, zip: e.target.value.replace(/\D/g, "").slice(0, 4) })} placeholder="1003" inputMode="numeric" pattern="\d{4}" />
                </label>
              </div>
              <label>
                <span>Type de profil</span>
                <select value={filters.kind} onChange={(e) => setFilters({ ...filters, kind: e.target.value as SearchFilters["kind"] })}>
                  <option value="all">Tous les professionnels</option>
                  <option value="company">Entreprises</option>
                  <option value="independent">Indépendants</option>
                </select>
              </label>
              <label>
                <span>Correspondance</span>
                <select value={filters.matchMode} onChange={(e) => setFilters({ ...filters, matchMode: e.target.value as SearchFilters["matchMode"] })}>
                  <option value="1">Contient les termes</option>
                  <option value="0">Expression exacte</option>
                  <option value="2">Similaire phonétiquement</option>
                  <option value="3">Large + phonétique</option>
                </select>
              </label>
              <button className="button button-primary button-full" disabled={loading}>{loading ? <><span className="spinner" />Recherche…</> : <>Lancer la recherche <ArrowIcon /></>}</button>
            </form>

            <div className="history-block">
              <div className="section-label"><ClockIcon />Recherches récentes</div>
              {history.length === 0 ? <p className="tiny-muted">Vos dernières recherches apparaîtront ici.</p> : (
                <ul className="history-list">
                  {history.map((item) => <li key={item.id}><button onClick={() => replay(item)}><span><strong>{item.keyword}</strong><small>{[item.zip, item.location].filter(Boolean).join(" ") || "Toute la Suisse"}</small></span><em>{item.resultCount}</em></button></li>)}
                </ul>
              )}
            </div>
          </aside>

          <section className="results-area" aria-live="polite">
            <ResultsHeader results={results} hitCount={hitCount} loading={loading} onExport={() => downloadProspectsCsv(results ?? [])} />
            {error && <div className="alert"><AlertIcon /><span>{error}</span></div>}
            <ProspectContent prospects={visibleProspects} loading={loading} savedIds={savedByProspectId} savingIds={savingIds} onToggleSaved={toggleSaved} />
          </section>
        </div>
      ) : (
        <section className="saved-page">
          <div className="saved-page-header">
            <div><p className="eyebrow">Votre sélection</p><h1>Prospects enregistrés</h1><p>Retrouvez les contacts que vous souhaitez approcher.</p></div>
            <button className="button button-secondary" onClick={() => downloadProspectsCsv(saved)} disabled={saved.length === 0}><DownloadIcon />Exporter en CSV</button>
          </div>
          {error && <div className="alert"><AlertIcon /><span>{error}</span></div>}
          <ProspectContent prospects={saved} loading={false} savedIds={savedByProspectId} savingIds={savingIds} onToggleSaved={toggleSaved} savedView />
        </section>
      )}
    </main>
  );
}

function ResultsHeader({ results, hitCount, loading, onExport }: { results: Prospect[] | null; hitCount: number; loading: boolean; onExport: () => void }) {
  return (
    <div className="results-header">
      <div>
        <p className="eyebrow">Annuaire professionnel suisse</p>
        <h2>{results === null && !loading ? "Prêt pour une nouvelle recherche" : loading ? "Recherche en cours" : `${results?.length ?? 0} résultat${results?.length === 1 ? "" : "s"}`}</h2>
        {results !== null && hitCount > results.length && <p>{results.length} contacts affichés parmi {hitCount} correspondances.</p>}
      </div>
      {results && results.length > 0 && <button className="button button-secondary" onClick={onExport}><DownloadIcon />Exporter en CSV</button>}
    </div>
  );
}

function ProspectContent({ prospects, loading, savedIds, savingIds, onToggleSaved, savedView = false }: { prospects: Prospect[] | null; loading: boolean; savedIds: Map<string, string>; savingIds: string[]; onToggleSaved: (prospect: Prospect) => void; savedView?: boolean }) {
  if (loading) return <div className="skeleton-list" aria-label="Chargement"><div /><div /><div /><div /></div>;
  if (prospects === null) return <EmptyState icon={<CompassIcon />} title="Votre prochain client est peut-être ici" text="Renseignez une activité, puis ajoutez une ville ou un NPA pour obtenir une liste ciblée." />;
  if (prospects.length === 0) return <EmptyState icon={savedView ? <BookmarkIcon /> : <SearchIcon />} title={savedView ? "Aucun prospect enregistré" : "Aucun résultat"} text={savedView ? "Enregistrez les contacts intéressants depuis une recherche." : "Essayez un terme plus large ou une autre zone géographique."} />;

  return (
    <div className="prospect-list">
      <div className="table-head"><span>Prospect</span><span>Coordonnées</span><span>Adresse</span><span className="sr-only">Action</span></div>
      {prospects.map((prospect) => <ProspectRow key={`${prospect.id}-${"savedId" in prospect ? prospect.savedId : "result"}`} prospect={prospect} isSaved={savedIds.has(prospect.id)} saving={savingIds.includes(prospect.id)} onToggleSaved={onToggleSaved} />)}
    </div>
  );
}

function ProspectRow({ prospect, isSaved, saving, onToggleSaved }: { prospect: Prospect; isSaved: boolean; saving: boolean; onToggleSaved: (prospect: Prospect) => void }) {
  const name = prospect.companyName || [prospect.firstName, prospect.lastName].filter(Boolean).join(" ") || "Professionnel sans nom";
  const category = typeof prospect.category === "string" ? prospect.category : prospect.category?.fr || prospect.category?.de || prospect.category?.it || prospect.category?.en;
  const phone = prospect.mobileNumbers[0] || prospect.phoneNumbers[0];
  const website = safeWebsite(prospect.url);
  return (
    <article className="prospect-row">
      <div className="prospect-identity"><span className="company-avatar">{initials(name)}</span><div><h3>{name}</h3>{category && <p>{category}</p>}<span className="profile-type">{prospect.companyName ? "Entreprise" : "Indépendant"}</span></div></div>
      <div className="contact-stack">
        {prospect.email && <a href={`mailto:${prospect.email}`}><MailIcon />{prospect.email}</a>}
        {phone && <a href={`tel:${phone.replace(/[^+\d]/g, "")}`}><PhoneIcon />{phone}</a>}
        {website && <a href={website} target="_blank" rel="noreferrer"><GlobeIcon />Site web</a>}
        {!prospect.email && !phone && !website && <span className="muted-dash">Non renseigné</span>}
      </div>
      <div className="address"><MapPinIcon /><span>{[prospect.street, prospect.houseNumber].filter(Boolean).join(" ") || "Adresse non renseignée"}<small>{[prospect.zip, prospect.location].filter(Boolean).join(" ")}</small></span></div>
      <button className={`save-button ${isSaved ? "saved" : ""}`} onClick={() => onToggleSaved(prospect)} disabled={saving} aria-label={isSaved ? `Retirer ${name} de la sélection` : `Enregistrer ${name}`} title={isSaved ? "Retirer" : "Enregistrer"}>{saving ? <span className="spinner spinner-dark" /> : <BookmarkIcon filled={isSaved} />}</button>
    </article>
  );
}

function EmptyState({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return <div className="empty-state"><span className="empty-icon">{icon}</span><h3>{title}</h3><p>{text}</p></div>;
}

function safeWebsite(value: string | null): string | null {
  if (!value) return null;
  try {
    const url = new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    return ["http:", "https:"].includes(url.protocol) ? url.toString() : null;
  } catch { return null; }
}

function initials(value: string): string {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "P";
}

function Icon({ children, filled = false }: { children: React.ReactNode; filled?: boolean }) { return <svg viewBox="0 0 24 24" aria-hidden="true" fill={filled ? "currentColor" : "none"}>{children}</svg>; }
function SearchIcon() { return <Icon><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></Icon>; }
function BookmarkIcon({ filled = false }: { filled?: boolean }) { return <Icon filled={filled}><path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-4-6 4V4.8Z" /></Icon>; }
function LogoutIcon() { return <Icon><path d="M10 5H5v14h5M14 8l4 4-4 4M18 12H9" /></Icon>; }
function ArrowIcon() { return <Icon><path d="M5 12h14M13 6l6 6-6 6" /></Icon>; }
function ClockIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></Icon>; }
function DownloadIcon() { return <Icon><path d="M12 3v12M7 10l5 5 5-5M5 20h14" /></Icon>; }
function AlertIcon() { return <Icon><path d="M12 8v5M12 17h.01" /><circle cx="12" cy="12" r="9" /></Icon>; }
function CompassIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></Icon>; }
function MailIcon() { return <Icon><rect x="3" y="5" width="18" height="14" rx="2" /><path d="m4 7 8 6 8-6" /></Icon>; }
function PhoneIcon() { return <Icon><path d="M8.2 4H5.5C4.7 4 4 4.7 4 5.5A14.5 14.5 0 0 0 18.5 20c.8 0 1.5-.7 1.5-1.5v-2.7l-3.6-.8-1.1 2.1a12 12 0 0 1-8.4-8.4L9 7.6 8.2 4Z" /></Icon>; }
function GlobeIcon() { return <Icon><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3c2.2 2.5 3.3 5.5 3.3 9s-1.1 6.5-3.3 9c-2.2-2.5-3.3-5.5-3.3-9S9.8 5.5 12 3Z" /></Icon>; }
function MapPinIcon() { return <Icon><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></Icon>; }
