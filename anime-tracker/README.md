# 🎬 Suivi d'anime

Petite appli pour faire regarder des anime à ton frère et **suivre son avancée**.

- **Toi (admin)** : tu ajoutes les anime + leurs épisodes (avec un lien vidéo), et tu as un **dashboard** qui montre où il en est (à voir / en cours / terminé, nombre d'épisodes vus, dernière activité).
- **Ton frère (spectateur)** : il regarde les épisodes dans un **lecteur intégré**. Dès qu'il finit un épisode, il est **marqué « vu » automatiquement** et le statut de l'anime se met à jour tout seul. Un bouton ✓ permet aussi de cocher/décocher à la main.

C'est un projet **séparé** du jeu DLE, dans le dossier `anime-tracker/`.

## Stack
- **Backend** : Node + Express + SQLite (better-sqlite3), authentification JWT.
- **Frontend** : React + Vite + TypeScript.

## Démarrage

### 1. Backend
```bash
cd anime-tracker/backend
npm install
cp .env.example .env      # adapte les identifiants si tu veux
npm run seed              # crée les 2 comptes (+ un anime de démo)
npm run dev               # API sur http://localhost:4000
```

Comptes créés par défaut (modifiables dans `.env`) :
- **Admin (toi)** : `moi` / `admin1234`
- **Spectateur (frère)** : `frere` / `frere1234`

### 2. Frontend
```bash
cd anime-tracker/frontend
npm install
npm run dev               # http://localhost:5174
```

Les deux serveurs tournent en même temps ; le frontend proxie `/api` vers le backend.

## Utilisation
1. Connecte-toi avec ton compte **admin**, va dans **Gérer** : ajoute un anime puis ses épisodes (colle un lien `.mp4`).
2. Ton frère se connecte avec son compte, ouvre l'anime et regarde. La progression se sauvegarde toute seule.
3. Tu suis tout depuis l'onglet **Suivi**.

> Astuce : pour les liens vidéo, un fichier `.mp4` direct fonctionne nativement avec le lecteur (auto-validation à 95 %). Les liens d'intégration externes (iframe) ne déclenchent pas l'auto-validation — dans ce cas le bouton ✓ sert à marquer l'épisode vu.

## Mise en production (optionnel)
```bash
cd anime-tracker/frontend && npm run build   # génère frontend/dist
cd ../backend && npm start                    # sert aussi le frontend compilé
```
Pense à mettre un vrai `JWT_SECRET` dans `.env`.
