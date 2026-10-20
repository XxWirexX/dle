import { requireAdmin } from '~~/server/utils/admin'
import { invalidateGameCache } from '~~/server/utils/gameCache'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { syncAttributeHintsWithUsedValues } from '~~/server/db/queries/games'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!

  const gameRow = await findGameIdBySlug(slug)
  if (!gameRow) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const results = await syncAttributeHintsWithUsedValues(gameRow.id)

  invalidateGameCache(slug)
  return { results }
})
