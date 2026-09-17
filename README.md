# DLE — v2

Jeu de devinette de personnages (style "OnePieceDLE") : Nuxt 3, Postgres,
Socket.IO. Voir `.claude/plans/` de la session pour le contexte complet de
la réécriture ; en résumé :

- Réécriture complète de l'ancienne version (branche `main`), architecture
  et code repartis de zéro.
- Front + back unifiés dans une seule app Nuxt (SSR).
- Postgres (Drizzle ORM) à la place des fichiers JSON à plat pour les
  données de jeu ; Cloudinary comme CDN pour toutes les images.
- Modes : Solo, Daily, Multijoueur (2 à N joueurs, matchmaking rapide 1v1
  + salons privés), avec système d'amis et présence en ligne.
- `legacy-content/` (non versionné) : données/images de l'ancienne version,
  gardées localement pour migration — récupérables depuis `main` si besoin
  (`backend/data/` et `backend/public/images/`).

## Setup

```bash
npm install
cp .env.example .env   # renseigner les vraies valeurs
docker compose up -d db   # Postgres local
npm run db:migrate
npm run dev
```

## Scripts utiles

- `npm run dev` — serveur de dev Nuxt (`http://localhost:3000`)
- `npm run build` / `npm run preview` — build de prod
- `npm run db:generate` / `npm run db:migrate` — migrations Drizzle
- `npm run migrate:legacy` — importe `legacy-content/` dans Postgres +
  Cloudinary (à lancer une fois, en local, avec `.env` renseigné)
- `npm test` — tests Vitest
