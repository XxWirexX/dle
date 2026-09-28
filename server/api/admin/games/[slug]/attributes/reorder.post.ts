import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/admin'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { invalidateGameCache } from '~~/server/utils/gameCache'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { reorderAttributes } from '~~/server/db/queries/games'

const schema = z.object({
  ids: z.array(z.number().int()).min(1).max(15),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const body = await readValidatedJsonBody(event, schema)

  const gameRow = await findGameIdBySlug(slug)
  if (!gameRow) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  await reorderAttributes(gameRow.id, body.ids)

  invalidateGameCache(slug)
  return { ok: true }
})
