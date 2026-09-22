import type { GameSummary, GameDetail, GamePlayData } from '#shared/types/game'
import { listPublicGames, findGameDetailBySlug, findGamePlayDataBySlug } from '~~/server/db/queries/games'

// Le contenu des jeux (officiels + DLE custom) est lu en permanence et
// n'écrit qu'occasionnellement (migration hors service, ou création/
// suppression d'un DLE custom, qui invalide explicitement le cache
// ci-dessous) : un cache mémoire simple évite un aller-retour Postgres à
// chaque requête, même logique que l'ancien `gameCache` chargé au démarrage.
let summariesCache: GameSummary[] | null = null
const detailCache = new Map<string, GameDetail | null>()
const playCache = new Map<string, GamePlayData | null>()

export async function getCachedGameSummaries(): Promise<GameSummary[]> {
  if (!summariesCache) summariesCache = await listPublicGames()
  return summariesCache
}

export async function getCachedGameDetail(slug: string): Promise<GameDetail | null> {
  if (!detailCache.has(slug)) {
    detailCache.set(slug, await findGameDetailBySlug(slug))
  }
  return detailCache.get(slug)!
}

export async function getCachedGamePlayData(slug: string): Promise<GamePlayData | null> {
  if (!playCache.has(slug)) {
    playCache.set(slug, await findGamePlayDataBySlug(slug))
  }
  return playCache.get(slug)!
}

/** À appeler après toute écriture sur `games`/`attributes`/`characters` (création/suppression de DLE custom). */
export function invalidateGameCache(slug?: string) {
  summariesCache = null
  if (slug) {
    detailCache.delete(slug)
    playCache.delete(slug)
  } else {
    detailCache.clear()
    playCache.clear()
  }
}
