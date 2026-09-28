import { requireAdmin } from '~~/server/utils/admin'
import { invalidateGameCache } from '~~/server/utils/gameCache'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { deleteAttribute } from '~~/server/db/queries/games'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const attributeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(attributeId)) throw createError({ statusCode: 400, message: 'Identifiant invalide' })

  const gameRow = await findGameIdBySlug(slug)
  if (!gameRow) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const deleted = await deleteAttribute(attributeId, gameRow.id)
  if (!deleted) throw createError({ statusCode: 404, message: 'Attribut introuvable dans ce jeu' })

  invalidateGameCache(slug)
  return { ok: true }
})
