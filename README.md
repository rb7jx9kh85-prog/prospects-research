# Piste

Application privée de recherche de prospects suisses. Elle interroge le module Search & Autocomplete de Multisource/search.ch, enregistre l’historique et les contacts sélectionnés dans Supabase, et expose une authentification serveur sans fournisseur d’identité externe.

## Fonctionnalités

- recherche d’entreprises et d’indépendants par activité, nom, localité et NPA;
- correspondance exacte, large ou phonétique;
- liste responsive avec e-mail, téléphone, adresse et site web;
- export CSV de tous les résultats affichés ou de la sélection enregistrée;
- historique des huit dernières recherches;
- sessions `HttpOnly`, mots de passe `scrypt`, protection CSRF par contrôle d’origine;
- verrouillage pendant 30 minutes après 10 échecs, appliqué au compte **et** à l’adresse IP;
- clé Multisource et clé Supabase secrète disponibles uniquement côté serveur.

### Export CSV

Après une recherche, le bouton **Exporter en CSV** apparaît au-dessus de la liste. Un second bouton est disponible dans l’onglet **Sélection**. Le fichier est encodé en UTF-8 avec BOM et utilise `;` comme séparateur pour une ouverture correcte dans Excel en configuration francophone.

Colonnes exportées: nom, type, catégorie, e-mail, téléphone, rue, NPA, localité et site web. Les valeurs commençant par `=`, `+`, `-` ou `@` sont neutralisées pour empêcher l’exécution de formules de tableur.

## Installation

Prérequis: Node.js 22+ et un projet Supabase.

```bash
npm install
cp .env.example .env.local
```

1. Suivez la section **Configuration Supabase** ci-dessous.
2. Complétez `.env.local` avec les quatre variables obligatoires.
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
| `SUPABASE_URL` | Oui | URL du projet, par exemple `https://abc.supabase.co`, disponible dans **Connect** ou **Settings → Data API** |
| `SUPABASE_SECRET_KEY` | Oui | Clé serveur moderne `sb_secret_...`, disponible dans **Settings → API Keys → Secret keys** |
| `MULTISOURCE_API_KEY` | Oui | Clé remise par Multisource après l’onboarding; envoyée au fournisseur dans `Auth-Key` |
| `AUTH_SECRET` | Oui | Secret aléatoire d’au moins 32 caractères pour pseudonymiser les compteurs de connexion |
| `SESSION_TTL_HOURS` | Non | Durée de session en heures, `12` par défaut; valeur autorisée de 1 à 168 |
| `MULTISOURCE_API_URL` | Non | URL de base, `https://api.multisource.ch/v2` par défaut |

Générez `AUTH_SECRET` localement avec:

```bash
openssl rand -hex 32
```

Exemple complet pour `.env.local` et Vercel:

```dotenv
SUPABASE_URL=https://votre-projet.supabase.co
SUPABASE_SECRET_KEY=sb_secret_xxxxxxxxxxxxxxxxx
MULTISOURCE_API_KEY=votre-cle-multisource
AUTH_SECRET=une-valeur-hexadecimale-de-64-caracteres
SESSION_TTL_HOURS=12
MULTISOURCE_API_URL=https://api.multisource.ch/v2
```

N’ajoutez aucun préfixe `NEXT_PUBLIC_`: aucune de ces variables ne doit atteindre le navigateur. Le code accepte encore `SUPABASE_SERVICE_ROLE_KEY` pour les anciens projets, mais `SUPABASE_SECRET_KEY` est recommandé pour un nouveau déploiement.

## Configuration Supabase

1. Créez un projet Supabase et choisissez une région proche de vos fonctions Vercel.
2. Dans **SQL Editor**, créez une nouvelle requête. Ouvrez le fichier [`supabase/migrations/202608060001_initial_schema.sql`](supabase/migrations/202608060001_initial_schema.sql) dans le dépôt, copiez **tout son contenu SQL** et collez-le dans l’éditeur, puis cliquez sur **Run**. Ne collez pas le chemin du fichier lui-même (`supabase/migrations/...`) : ce n’est pas une commande SQL.
3. Dans **Table Editor**, vérifiez la présence de `app_users`, `auth_sessions`, `login_attempts`, `prospect_searches` et `saved_prospects`.
4. Dans **Settings → API Keys**, créez ou copiez une clé **Secret** commençant par `sb_secret_`. N’utilisez ni la clé Publishable ni la clé `anon` pour `SUPABASE_SECRET_KEY`.
5. Récupérez l’URL du projet depuis **Connect** ou **Settings → Data API**.
6. Placez l’URL et la clé secrète dans `.env.local`, puis créez le premier utilisateur:

```bash
read -s NEW_USER_PASSWORD && export NEW_USER_PASSWORD
npm run user:create -- admin "Administrateur"
unset NEW_USER_PASSWORD
```

Le mot de passe doit contenir au moins 14 caractères, une majuscule, une minuscule, un chiffre et un caractère spécial. Le script peut être relancé avec le même identifiant pour changer son nom ou son mot de passe.

Le projet n’utilise pas Supabase Auth: il ne faut donc configurer ni URL de redirection ni fournisseur de connexion dans Supabase. Supabase sert ici de base Postgres privée et de Data API appelée uniquement par le serveur Next.js.

### Si Vercel indique qu’une variable existe déjà

Dans **Project → Settings → Environment Variables**, ouvre la variable existante (`AUTH_SECRET`, `SUPABASE_URL`, etc.) et clique sur **Edit** pour modifier sa valeur ou ses environnements. Ne clique pas sur **Add** avec le même nom. Si nécessaire, supprime l’ancienne variable puis recrée-la une seule fois pour **Production**, **Preview** et **Development**.

## Sécurité

L’authentification n’utilise pas de bibliothèque d’auth ni de SDK Supabase. Les primitives cryptographiques viennent du module natif `node:crypto`: `scrypt` (N=32768, r=8, p=1), sels aléatoires, comparaison constante, jetons de 256 bits et stockage SHA-256 des jetons. Les réponses de connexion restent génériques pour limiter l’énumération de comptes.

La limitation est atomique dans Postgres. Chaque échec incrémente deux compteurs pseudonymisés par HMAC: le nom d’utilisateur et l’IP. Après le dixième échec, les deux sont verrouillés 30 minutes. Une connexion valide efface les compteurs concernés.

La promesse « aucune faille possible » n’est techniquement réaliste pour un logiciel. Ce projet applique une base robuste, mais un déploiement public doit encore bénéficier de TLS, d’une rotation des secrets, de sauvegardes, de logs surveillés, des mises à jour de dépendances et idéalement d’un audit indépendant.

## Déploiement sur Vercel

1. Poussez le projet sur GitHub, idéalement sur la branche `main`.
2. Dans Vercel, choisissez **Add New → Project**, importez le dépôt GitHub et laissez Vercel détecter **Next.js**.
3. Si ce dépôt contient uniquement l’application, gardez la racine du dépôt comme **Root Directory**. Sinon, sélectionnez le dossier `prospects-research`.
4. Dans **Project → Settings → Environment Variables**, ajoutez les six variables du bloc ci-dessus. Les quatre premières sont obligatoires; les deux dernières peuvent conserver leur valeur proposée.
5. Cochez **Production**, **Preview** et **Development** pour chaque variable si les trois environnements utilisent le même projet Supabase. Pour une isolation stricte, créez plutôt un second projet Supabase et une seconde clé Multisource pour Preview.
6. Dans les réglages du projet, utilisez Node.js 22 ou une version plus récente compatible avec `package.json`.
7. Lancez le déploiement. Après toute modification d’une variable, effectuez un nouveau déploiement: les déploiements déjà créés ne reçoivent pas les nouvelles valeurs.
8. Testez `/login`, connectez-vous, lancez une recherche, enregistrez un prospect et téléchargez les deux exports CSV.

Vercel fournit automatiquement HTTPS. En production, l’application active alors le cookie `__Host-prospect_session`, HSTS et la politique CSP avec nonce. Aucun `vercel.json` n’est requis.

Pour synchroniser les variables Vercel vers votre machine avec la CLI:

```bash
vercel link
vercel env pull .env.local
```

Attention: cette commande écrit les secrets dans `.env.local`. Ce fichier est ignoré par Git et ne doit jamais être commité.

Avant chaque mise en production:

```bash
npm test
npm run lint
npm run typecheck
npm run build
```

## Détails de l’annuaire

La recherche appelle `GET /Search/AutoComplete` avec `source=business`. Le fournisseur ne renvoie pas de champ juridique explicite pour différencier une société d’un indépendant; l’option « Indépendants » utilise donc l’absence de `companyname` et la présence d’un prénom/nom comme approximation. Ce comportement est isolé dans `src/lib/multisource.ts` et peut être ajusté si l’abonnement expose un champ supplémentaire.
