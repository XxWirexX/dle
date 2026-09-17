# DLE — rewrite v2

Cette branche (`rewrite/v2`) repart de zéro sur l'implémentation. C'est une
branche orpheline : aucun historique commun avec `main`, qui reste
l'ancienne version en production.

## État actuel

Rien n'est encore codé. Cette branche ne contient pour l'instant que :

- `legacy-content/` (non versionné, présent seulement sur disque) : les
  données de jeu de l'ancienne version (`anime-data/*.json` +
  `anime-images/`), gardées pour être migrées vers la nouvelle structure
  de stockage (base de données + CDN) au lieu d'être ressaisies à la main.
  Si ce dossier n'existe pas sur ta machine, il reste récupérable depuis
  `main` (`backend/data/` et `backend/public/images/`).

## Décisions actées avant le rewrite

- Frontend : Vue
- Backend : Node, avec un stockage structuré pour les personnages/attributs
  (fini les JSON à plat) + un CDN pour les images (Cloudinary déjà en place
  côté ancienne version pour les DLE custom, à étendre au contenu officiel)
- Comptes utilisateurs, DB, setup de déploiement : repartent de zéro
  (aucune donnée de l'ancienne base users n'est reprise)

## À venir

Architecture détaillée et plan d'implémentation une fois le concept produit
reçu.
