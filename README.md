# Piste

Application privée de recherche de prospects suisses. Elle interroge le module Search & Autocomplete de Multisource/search.ch, enregistre l’historique et les contacts sélectionnés dans Vercel Blob, et expose une authentification serveur sans fournisseur d’identité externe.

## Fonctionnalités

- recherche d’entreprises et d’indépendants par activité, nom, localité et NPA;
- correspondance exacte, large ou phonétique;
- liste responsive avec e-mail, téléphone, adresse et site web;
- export CSV de tous les résultats affichés ou de la sélection enregistrée;
- historique des huit dernières recherches;
- sessions `HttpOnly`, mots de passe `scrypt`, protection CSRF par contrôle d’origine;
- verrouillage pendant 30 minutes après 10 échecs, appliqué au compte **et** à l’adresse IP;
- clé Multisource et jeton Blob disponibles uniquement côté serveur.

### Export CSV

Après une recherche, le bouton **Exporter en CSV** apparaît au-dessus de la liste. Un second bouton est disponible dans l’onglet **Sélection**. Le fichier est encodé en UTF-8 avec BOM et utilise `;` comme séparateur pour une ouverture correcte dans Excel en configuration francophone.

Colonnes exportées: nom, type, catégorie, e-mail, téléphone, rue, NPA, localité et site web. Les valeurs commençant par `=`, `+`, `-` ou `@` sont neutralisées pour empêcher l’exécution de formules de tableur.

## Installation

Prérequis: Node.js 22+ et un store Vercel Blob.

```bash
npm install
cp .env.example .env.local
```

1. Suivez la section **Configuration Vercel Blob** ci-dessous.
2. Complétez `.env.local` avec les deux variables obligatoires.
3. Créez le premier compte:

```bash
read -s NEW_USER_PASSWORD && export NEW_USER_PASSWORD
npm run user:create -- admin "Administrateur"
unset NEW_USER_PASSWORD
```

4. Lancez l’application:

```bash
npm run dev
```

Ouvrez [http://localhost:3000](http://localhost:3000).

## Variables d’environnement complètes

| Variable | Obligatoire | Valeur / provenance |
| --- | --- | --- |
| `MULTISOURCE_API_KEY` | Oui | Clé remise par Multisource après l’onboarding; envoyée au fournisseur dans `Auth-Key` |
| `AUTH_SECRET` | Oui | Secret aléatoire d’au moins 32 caractères pour pseudonymiser les compteurs de connexion |
| `BLOB_READ_WRITE_TOKEN` | Oui (local) | Jeton du store Vercel Blob; injecté automatiquement en production quand le store est lié au projet |
| `SESSION_TTL_HOURS` | Non | Durée de session en heures, `12` par défaut; valeur autorisée de 1 à 168 |
| `MULTISOURCE_API_URL` | Non | URL de base, `https://api.multisource.ch/v2` par défaut |

Générez `AUTH_SECRET` localement avec:

```bash
openssl rand -hex 32
```

N’ajoutez aucun préfixe `NEXT_PUBLIC_`: aucune de ces variables ne doit atteindre le navigateur.

## Configuration Vercel Blob

1. Dans le tableau de bord Vercel, ouvrez **Storage → Create Database → Blob** et liez le store à ce projet (ou utilisez un store existant).
2. Localement, synchronisez le jeton généré:

```bash
vercel link
vercel env pull .env.local
```

Cette commande écrit `BLOB_READ_WRITE_TOKEN` (entre autres) dans `.env.local`. Ce fichier est ignoré par Git et ne doit jamais être commité.

3. Créez le premier utilisateur:

```bash
read -s NEW_USER_PASSWORD && export NEW_USER_PASSWORD
npm run user:create -- admin "Administrateur"
unset NEW_USER_PASSWORD
```

Le mot de passe doit contenir au moins 14 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial. Le script peut être relancé avec le même identifiant pour changer son nom ou son mot de passe.

L’application stocke ses données dans quelques fichiers JSON privés du store Blob (`data/users.json`, `data/sessions.json`, `data/login-attempts.json`, `data/search-history.json`, `data/saved-prospects.json`), lus et réécrits par le serveur uniquement. Aucun accès public n’est configuré: tous les blobs sont créés avec `access: "private"`.

## Sécurité

L’authentification n’utilise pas de bibliothèque d’auth ni de SDK tiers. Les primitives cryptographiques viennent du module natif `node:crypto`: `scrypt` (N=32768, r=8, p=1), sels aléatoires, comparaison constante, jetons de 256 bits et stockage SHA-256 des jetons. Les réponses de connexion restent génériques pour limiter l’énumération de comptes.

Chaque échec incrémente deux compteurs pseudonymisés par HMAC: le nom d’utilisateur et l’IP. Après le dixième échec, les deux sont verrouillés 30 minutes. Une connexion valide efface les compteurs concernés. Les écritures sur les fichiers JSON utilisent l’en-tête conditionnel `If-Match` de Vercel Blob pour éviter les pertes d’écritures concurrentes, avec quelques tentatives automatiques en cas de conflit.

La promesse « aucune faille possible » n’est techniquement réaliste pour un logiciel. Ce projet applique une base robuste, mais un déploiement public doit encore bénéficier de TLS, d’une rotation des secrets, de sauvegardes, de logs surveillés, des mises à jour de dépendances et idéalement d’un audit indépendant.

## Déploiement sur Vercel

1. Poussez le projet sur GitHub, idéalement sur la branche `main`.
2. Dans Vercel, choisissez **Add New → Project**, importez le dépôt GitHub et laissez Vercel détecter **Next.js**.
3. Si ce dépôt contient uniquement l’application, gardez la racine du dépôt comme **Root Directory**. Sinon, sélectionnez le dossier `prospects-research`.
4. Dans **Storage**, liez (ou créez) un store Vercel Blob à ce projet: `BLOB_READ_WRITE_TOKEN` est alors injecté automatiquement dans tous les environnements.
5. Dans **Project → Settings → Environment Variables**, ajoutez `MULTISOURCE_API_KEY` et `AUTH_SECRET` (obligatoires), et éventuellement `SESSION_TTL_HOURS` / `MULTISOURCE_API_URL`.
6. Dans les réglages du projet, utilisez Node.js 22 ou une version plus récente compatible avec `package.json`.
7. Lancez le déploiement. Après toute modification d’une variable, effectuez un nouveau déploiement: les déploiements déjà créés ne reçoivent pas les nouvelles valeurs.
8. Testez `/login`, connectez-vous, lancez une recherche, enregistrez un prospect et téléchargez les deux exports CSV.

Vercel fournit automatiquement HTTPS. En production, l’application active alors le cookie `__Host-prospect_session`, HSTS et la politique CSP avec nonce. Aucun `vercel.json` n’est requis.

Avant chaque mise en production:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Détails de l’annuaire

La recherche appelle `GET /Search/AutoComplete` avec `source=business`. Le fournisseur ne renvoie pas de champ juridique explicite pour différencier une société d’un indépendant; l’option « Indépendants » utilise donc l’absence de `companyname` et la présence d’un prénom/nom comme approximation. Ce comportement est isolé dans `src/lib/multisource.ts` et peut être ajusté si l’abonnement expose un champ supplémentaire.
