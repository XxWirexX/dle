import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/admin'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { invalidateGameCache } from '~~/server/utils/gameCache'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { updateGameMeta } from '~~/server/db/queries/games'

const schema = z.object({
  name: z.string().trim().min(2).max(100),
  maxAttempts: z.number().int().min(4).max(40),
  iconUrl: z.string().nullable().optional(),
  iconPublicId: z.string().nullable().optional(),
  backgroundUrl: z.string().nullable().optional(),
  backgroundPublicId: z.string().nullable().optional(),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const body = await readValidatedJsonBody(event, schema)

  const gameRow = await findGameIdBySlug(slug)
  if (!gameRow) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  await updateGameMeta(gameRow.id, {
    name: body.name,
    maxAttempts: body.maxAttempts,
    iconUrl: body.iconUrl ?? null,
    iconPublicId: body.iconPublicId ?? null,
    backgroundUrl: body.backgroundUrl ?? null,
    backgroundPublicId: body.backgroundPublicId ?? null,
  })

  invalidateGameCache(slug)
  return { ok: true }
})
