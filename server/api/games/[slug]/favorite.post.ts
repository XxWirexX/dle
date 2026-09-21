import { requireAuthPayload } from '~~/server/utils/session'
import { toggleFavorite } from '~~/server/db/queries/favorites'
import { findGameIdBySlug } from '~~/server/db/queries/stats'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  const slug = getRouterParam(event, 'slug')!

  const game = await findGameIdBySlug(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const favorited = await toggleFavorite(userId, game.id)
  return { favorited }
})
