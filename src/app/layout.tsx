import type { Metadata } from "next";
import { connection } from "next/server";
import "./globals.css";

export const metadata: Metadata = {
  title: "Piste — Recherche de prospects suisses",
  description: "Trouvez et organisez des entreprises et indépendants en Suisse.",
  robots: { index: false, follow: false },
};

export default async function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  // A per-request render is required for the nonce-based Content Security Policy.
  await connection();
  return (
    <html lang="fr">
      <body>{children}</body>
    </html>
  );
}
