import { requireAuthPayload } from '~~/server/utils/session'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { deleteGame } from '~~/server/db/queries/games'
import { invalidateGameCache } from '~~/server/utils/gameCache'

// Le créateur seulement peut supprimer son DLE custom (deleteGame filtre
// déjà sur owner_id) — les jeux officiels n'ont pas d'owner donc ne
// peuvent jamais matcher, pas besoin de vérifier isOfficial séparément.
export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  const slug = getRouterParam(event, 'slug')!

  const game = await findGameIdBySlug(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const deleted = await deleteGame(game.id, userId)
  if (!deleted) throw createError({ statusCode: 403, message: "Tu n'es pas le créateur de ce DLE" })

  invalidateGameCache(slug)
  return { ok: true }
})
