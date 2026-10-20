import { requireAdmin } from '~~/server/utils/admin'
import { getCachedGamePlayData, getCachedSolverBenchmark, setCachedSolverBenchmark } from '~~/server/utils/gameCache'
import { computeOpenerStats, computeBenchmark } from '#shared/utils/solver'

// Même ordre de grandeur que l'arbre de décision (voir solver.get.ts) —
// la résolution complète de l'arbre ici n'a pas de limite de profondeur,
// donc ces plafonds sont ce qui protège réellement le site d'un calcul
// trop long sur un très gros jeu.
const MAX_NODES = 2000
const MAX_TIME_MS = 8000

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!

  const cached = getCachedSolverBenchmark(slug)
  if (cached) return { ...cached, cached: true }

  const game = await getCachedGamePlayData(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  if (game.characters.length < 2) {
    throw createError({ statusCode: 400, message: 'Pas assez de personnages pour calculer un benchmark' })
  }

  const stats = computeOpenerStats(game.characters, game.attributes)
  const result = await computeBenchmark(game.characters, game.attributes, stats, {
    maxNodes: MAX_NODES,
    maxTimeMs: MAX_TIME_MS,
    onYield: () => new Promise((resolve) => setImmediate(resolve)),
  })

  // Un calcul coupé par le budget n'est qu'une approximation — pas la peine
  // de le garder en cache comme s'il était définitif, un prochain appel
  // (potentiellement avec un peu plus de marge CPU disponible) vaut mieux.
  if (!result.budgetExceeded) setCachedSolverBenchmark(slug, result)

  return { ...result, cached: false }
})
