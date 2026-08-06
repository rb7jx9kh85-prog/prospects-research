import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { LoginForm } from "@/components/login-form";

export default async function LoginPage() {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <main className="login-shell">
      <section className="login-brand" aria-labelledby="brand-title">
        <div className="brand-mark" aria-hidden="true"><span /><span /></div>
        <div className="login-brand-copy">
          <p className="eyebrow">Prospection suisse</p>
          <h1 id="brand-title">Des entreprises pertinentes. Sans bruit.</h1>
          <p>Interrogez l’annuaire professionnel suisse, affinez vos critères et gardez les bons contacts au même endroit.</p>
        </div>
        <p className="source-note">Données d’annuaire via Multisource / search.ch</p>
      </section>
      <section className="login-panel" aria-label="Connexion">
        <div className="login-card">
          <div>
            <p className="eyebrow">Espace privé</p>
            <h2>Connexion</h2>
            <p className="muted">Utilisez les accès transmis par votre administrateur.</p>
          </div>
          <LoginForm />
          <div className="security-note">
            <LockIcon />
            <span>Connexion chiffrée · verrouillage après 10 essais</span>
          </div>
        </div>
      </section>
    </main>
  );
}

function LockIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3" /></svg>;
}
