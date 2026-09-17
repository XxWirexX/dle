import type { GameSummary, GameDetail, GamePlayData } from '#shared/types/game'
import { listOfficialGames, findGameDetailBySlug, findGamePlayDataBySlug } from '~~/server/db/queries/games'

// Le contenu des jeux officiels est lu en permanence et n'écrit jamais au
// runtime (seul le script de migration l'alimente, hors service) : un
// cache mémoire simple évite un aller-retour Postgres à chaque requête,
// même logique que l'ancien `gameCache` chargé une fois au démarrage.
let summariesCache: GameSummary[] | null = null
const detailCache = new Map<string, GameDetail | null>()
const playCache = new Map<string, GamePlayData | null>()

export async function getCachedGameSummaries(): Promise<GameSummary[]> {
  if (!summariesCache) summariesCache = await listOfficialGames()
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

/** À appeler après toute écriture sur `games`/`attributes`/`characters` (création de DLE custom, phase future). */
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
