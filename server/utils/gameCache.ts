import type { GameSummary, GameDetail, GamePlayData } from '#shared/types/game'
import type { BenchmarkResult } from '#shared/utils/solver'
import { listPublicGames, findGameDetailBySlug, findGamePlayDataBySlug } from '~~/server/db/queries/games'

// Le contenu des jeux (officiels + DLE custom) est lu en permanence et
// n'écrit qu'occasionnellement (migration hors service, ou création/
// suppression d'un DLE custom, qui invalide explicitement le cache
// ci-dessous) : un cache mémoire simple évite un aller-retour Postgres à
// chaque requête, même logique que l'ancien `gameCache` chargé au démarrage.
let summariesCache: GameSummary[] | null = null
const detailCache = new Map<string, GameDetail | null>()
const playCache = new Map<string, GamePlayData | null>()
// Le benchmark du solveur (coups moyens, efficacité info) résout l'arbre en
// entier — nettement plus lourd qu'une simple lecture DB — donc on le garde
// en cache tant que le contenu du jeu n'a pas changé, plutôt que de le
// recalculer à chaque chargement de la page admin.
const solverBenchmarkCache = new Map<string, BenchmarkResult>()

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

export function getCachedSolverBenchmark(slug: string): BenchmarkResult | undefined {
  return solverBenchmarkCache.get(slug)
}

export function setCachedSolverBenchmark(slug: string, result: BenchmarkResult): void {
  solverBenchmarkCache.set(slug, result)
}

/** À appeler après toute écriture sur `games`/`attributes`/`characters` (création/suppression de DLE custom). */
export function invalidateGameCache(slug?: string) {
  summariesCache = null
  if (slug) {
    detailCache.delete(slug)
    playCache.delete(slug)
    solverBenchmarkCache.delete(slug)
  } else {
    detailCache.clear()
    playCache.clear()
    solverBenchmarkCache.clear()
  }
}
