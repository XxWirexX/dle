import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/admin'
import { readValidatedQuery } from '~~/server/utils/validate'
import { getCachedGamePlayData } from '~~/server/utils/gameCache'
import { computeOpenerStats, buildSolverTree } from '#shared/utils/solver'

const querySchema = z.object({
  maxDepth: z.coerce.number().int().min(1).max(4).default(2),
  rootId: z.coerce.number().int().optional(),
})

// Plafond dur sur le nombre de nœuds de l'arbre, indépendant de maxDepth :
// même avec une profondeur faible, un jeu avec beaucoup de personnages et
// peu d'attributs discriminants pourrait brancher très large à chaque
// niveau. Ce budget protège le process Node (mono-thread, un seul event
// loop pour tout le site) de tout calcul qui prendrait trop longtemps —
// quel que soit le jeu ou la profondeur demandée.
const MAX_NODES = 400
// Deuxième filet, indépendant : le coût d'UN SEUL nœud grandit avec le
// nombre de personnages (recherche O(n²)) — sur un très gros jeu, un seul
// nœud coûteux peut à lui seul dépasser largement ce que MAX_NODES est
// censé borner. Mesuré en local : ~250ms pour un nœud sur 400 personnages
// avec peu de diversité d'attributs (pire cas réaliste) — 5s laisse une
// marge confortable même pour un jeu nettement plus gros que tout ce qui
// existe aujourd'hui, sans jamais risquer de bloquer le site une éternité.
const MAX_TIME_MS = 5000

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const query = readValidatedQuery(event, querySchema)

  const game = await getCachedGamePlayData(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  if (game.characters.length < 2) {
    throw createError({ statusCode: 400, message: 'Pas assez de personnages pour calculer un arbre de guess' })
  }
  if (query.rootId && !game.characters.some((c) => c.id === query.rootId)) {
    throw createError({ statusCode: 400, message: 'Personnage de départ introuvable dans ce jeu' })
  }

  const stats = computeOpenerStats(game.characters, game.attributes)

  const start = Date.now()
  const { tree, nodesComputed, budgetExceeded } = await buildSolverTree(game.characters, game.attributes, {
    maxDepth: query.maxDepth,
    maxNodes: MAX_NODES,
    maxTimeMs: MAX_TIME_MS,
    rootCharacterId: query.rootId,
    // Rend la main à la boucle d'événements toutes les ~15 nœuds : même un
    // calcul qui prendrait plusieurs secondes ne bloque jamais les autres
    // requêtes (joueurs sur le site) pendant qu'il tourne.
    onYield: () => new Promise((resolve) => setImmediate(resolve)),
  })

  return { stats, tree, nodesComputed, budgetExceeded, computeTimeMs: Date.now() - start }
})
