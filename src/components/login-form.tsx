"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export function LoginForm() {
  const router = useRouter();
  const [error, setError] = useState("");
  const [remaining, setRemaining] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");
    const form = new FormData(event.currentTarget);

    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: form.get("username"), password: form.get("password") }),
      });
      const payload = (await response.json()) as { error?: string; attemptsRemaining?: number };
      if (!response.ok) {
        setError(payload.error ?? "Connexion impossible.");
        setRemaining(typeof payload.attemptsRemaining === "number" ? payload.attemptsRemaining : null);
        return;
      }
      router.replace("/dashboard");
      router.refresh();
    } catch {
      setError("Le service est indisponible. Réessayez dans un instant.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className="login-form" onSubmit={submit}>
      <label>
        <span>Nom d’utilisateur</span>
        <input name="username" autoComplete="username" required minLength={3} maxLength={80} />
      </label>
      <label>
        <span>Mot de passe</span>
        <input name="password" type="password" autoComplete="current-password" required maxLength={256} />
      </label>
      <div className="form-feedback" aria-live="polite">
        {error && <p className="error-message">{error}</p>}
        {remaining !== null && remaining > 0 && <p className="attempt-message">{remaining} essai{remaining > 1 ? "s" : ""} restant{remaining > 1 ? "s" : ""}</p>}
      </div>
      <button className="button button-primary button-full" disabled={loading}>
        {loading ? <><span className="spinner" />Vérification…</> : <>Se connecter <ArrowIcon /></>}
      </button>
    </form>
  );
}

function ArrowIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
}
