# Lancer le projet en local

Ce guide couvre l'installation complète en local, y compris la récupération
et l'import du contenu de l'ancienne version (`main`) dans la nouvelle
base de données.

## Prérequis

- Node.js 22+
- Docker (pour Postgres — ou une instance Postgres 16 déjà installée en
  natif, ce qui fonctionne tout aussi bien : seule l'URL de connexion
  compte)
- Un compte Cloudinary (gratuit) si tu veux uploader de vraies images ;
  sinon la migration peut tourner en mode "dry run" sans Cloudinary (voir
  plus bas)

## 1. Dépendances

```bash
npm install
```

## 2. Configuration

```bash
cp .env.example .env
```

Renseigne dans `.env` :

- `DATABASE_URL` — ex. `postgres://dle:dle@localhost:5432/dle` (valeur par
  défaut déjà cohérente avec `docker-compose.yml`)
- `JWT_SECRET` — une vraie valeur aléatoire (`openssl rand -hex 32`), pas
  de fallback en dur dans le code : l'app refuse de démarrer sans
- `SMTP_*` — optionnel en dev : si absent, les emails de vérification/reset
  ne sont pas envoyés, le lien est juste affiché dans les logs du serveur
  (`WARN [email] SMTP non configuré — lien de vérification pour ...`)
- `CLOUDINARY_*` — nécessaire uniquement si tu veux de vraies images
  (voir §5). **Ne réutilise pas l'ancien secret Cloudinary** : il a fuité
  dans l'historique git de la v1 (`main`) et doit être régénéré depuis le
  dashboard Cloudinary, indépendamment de ce projet.
- `FRONTEND_URL` — laisse `http://localhost:3000` en local

## 3. Base de données

```bash
docker compose up -d db
npm run db:migrate
```

`db:migrate` applique les migrations Drizzle (`drizzle/*.sql`) — commande
idempotente, sans risque de la relancer.

À ce stade l'app tourne (`npm run dev`) mais la base est vide : aucun jeu
à jouer. La suite explique comment récupérer le contenu de l'ancienne
version.

## 4. Récupérer les données de l'ancienne version

Le contenu (personnages + images de tous les animes) n'a jamais été
recopié à la main dans cette réécriture — il est importé depuis l'ancienne
version (branche `main`) via un script dédié. Ce contenu vit dans
`legacy-content/` à la racine du projet, **volontairement non versionné**
(voir `.gitignore`) car ce ne sont que des données sources pour une
migration ponctuelle, pas du code de l'app.

Structure attendue :

```
legacy-content/
├── anime-data/           # un .json par jeu — copie de backend/data/ sur main
│   ├── death-note.json
│   ├── one-piece.json
│   └── ...
└── anime-images/         # copie de backend/public/images/ sur main
    ├── death-note/
    │   ├── cardIcon.jpg
    │   ├── background.jpg
    │   └── characters/
    │       ├── light yagami.webp
    │       └── ...
    └── ...
```

Si tu as un clone local du dépôt avec la branche `main` disponible :

```bash
git worktree add /tmp/dle-legacy main
mkdir -p legacy-content
cp -r /tmp/dle-legacy/backend/data legacy-content/anime-data
cp -r /tmp/dle-legacy/backend/public/images legacy-content/anime-images
git worktree remove /tmp/dle-legacy
```

(`git worktree` évite d'avoir à `checkout` et perdre ta position sur
`rewrite/v2` pendant la copie.)

Si tu n'as accès qu'au dépôt distant :

```bash
git archive origin/main -- backend/data backend/public/images | tar -x
mkdir -p legacy-content
mv backend/data legacy-content/anime-data
mv backend/public/images legacy-content/anime-images
rmdir backend/public backend
```

## 5. Lancer la migration

```bash
npm run migrate:legacy
```

Ce script (`scripts/migrate-legacy-data.ts`) :

- lit chaque `legacy-content/anime-data/*.json` et upsert le jeu +
  ses attributs + ses personnages dans Postgres (par `slug`, donc
  relançable sans dupliquer) ;
- uploade chaque image trouvée dans `legacy-content/anime-images/` vers
  Cloudinary, et stocke l'URL + le `public_id` retournés sur la ligne
  correspondante ;
- normalise au passage deux incohérences historiques des données v1 :
  le type d'attribut manquant sur `star-wars.json` (`appearance`) et le
  synonyme `"multi"` → `"multiple"` utilisé dans `oshi-no-ko.json`.

**Sans compte Cloudinary configuré**, lance-le en mode dry-run — la partie
DB est identique, seul l'upload d'images est sauté (les personnages auront
une image vide) :

```bash
MIGRATE_DRY_RUN=1 npm run migrate:legacy
```

À la fin, le script affiche le nombre de personnages migrés par jeu et le
nombre d'images effectivement trouvées en local — compare ces chiffres au
nombre de personnages dans le `.json` correspondant si tu veux vérifier
que rien n'a été perdu.

## 6. Lancer l'app

```bash
npm run dev
```

→ [http://localhost:3000](http://localhost:3000)

Un premier compte se crée via `/register` ; sans SMTP configuré, le lien
de vérification apparaît directement dans les logs du terminal.

## Autres commandes utiles

- `npm test` — tests Vitest (logique de feedback des attributs)
- `npm run build && node .output/server/index.mjs` — build de prod en
  local, sans Docker
- `npm run db:generate` — génère une nouvelle migration Drizzle après
  modification de `server/db/schema.ts`

## Déploiement

Voir `Dockerfile` et `docker-compose.yml` : l'image de prod (`runtime`)
ne contient que le bundle Nitro buildé, et les migrations se lancent à
part via `docker compose run --rm migrate` (détaillé dans
`.github/workflows/deploy.yml`).

## Dépannage

- **"JWT_SECRET manquant" / l'app refuse de démarrer** — `.env` non
  chargé ou `JWT_SECRET` vide ; contrairement à la v1, il n'y a pas de
  valeur par défaut de secours.
- **Erreur bcrypt/sharp au démarrage après un `npm install` sur une autre
  machine que celle du build** — ces deux paquets ont des binaires
  natifs par plateforme ; réinstalle (`rm -rf node_modules && npm install`)
  sur la machine qui exécute réellement le code (ou reconstruis l'image
  Docker, qui compile dans son propre environnement).
- **`migrate:legacy` échoue sur `CLOUDINARY_CLOUD_NAME manquant`** —
  utilise `MIGRATE_DRY_RUN=1` (§5) ou renseigne un compte Cloudinary.
- **Les pages `/friends`, `/profile` etc. renvoient 401 en SSR** — vérifie
  que tu es bien connecté (cookie `dle_token`) ; si le bug persiste après
  connexion, c'est probablement un appel `$fetch`/`useFetch` côté serveur
  qui ne relaie pas le cookie — utiliser `apiFetch` (`app/composables/
  useApi.ts`) plutôt que `$fetch` directement pour tout appel à l'API de
  l'app fait pendant le rendu serveur.
