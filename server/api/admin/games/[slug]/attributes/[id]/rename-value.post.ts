import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/admin'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { invalidateGameCache } from '~~/server/utils/gameCache'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { renameAttributeValues } from '~~/server/db/queries/games'

const schema = z.object({
  rules: z.array(z.object({
    from: z.string().trim().min(1).max(200),
    to: z.string().trim().min(1).max(200).nullable(),
  })).min(1).max(200),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const attributeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(attributeId)) throw createError({ statusCode: 400, message: 'Identifiant invalide' })

  const body = await readValidatedJsonBody(event, schema)

  const gameRow = await findGameIdBySlug(slug)
  if (!gameRow) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const results = await renameAttributeValues(gameRow.id, attributeId, body.rules)

  invalidateGameCache(slug)
  return { results }
})
