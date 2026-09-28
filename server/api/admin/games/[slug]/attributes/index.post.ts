import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/admin'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { getCachedGamePlayData, invalidateGameCache } from '~~/server/utils/gameCache'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { addAttribute } from '~~/server/db/queries/games'

const schema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/).min(1).max(40),
  label: z.string().trim().min(1).max(60),
  type: z.enum(['text', 'number', 'ordered', 'multiple', 'text-group', 'boolean']),
  order: z.array(z.string().trim().min(1)).max(100).optional(),
  hints: z.array(z.string().trim().min(1)).max(300).optional(),
  groups: z.array(z.array(z.string().trim().min(1)).min(1)).max(30).optional(),
}).refine((a) => a.type !== 'ordered' || (a.order && a.order.length >= 2), {
  message: 'Un attribut "ordonné" a besoin d\'au moins 2 valeurs',
}).refine((a) => a.type !== 'text-group' || (a.groups && a.groups.length >= 1), {
  message: 'Un attribut "groupe" a besoin d\'au moins un groupe',
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const body = await readValidatedJsonBody(event, schema)

  const gameRow = await findGameIdBySlug(slug)
  if (!gameRow) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const game = await getCachedGamePlayData(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  if (game.attributes.length >= 15) throw createError({ statusCode: 400, message: 'Maximum 15 attributs par jeu' })
  if (game.attributes.some((a) => a.key === body.key)) {
    throw createError({ statusCode: 400, message: 'Cette clé est déjà utilisée par un autre attribut' })
  }

  const { id } = await addAttribute(gameRow.id, {
    key: body.key,
    label: body.label,
    type: body.type,
    order: body.type === 'ordered' ? body.order : undefined,
    hints: body.hints,
    groups: body.type === 'text-group' ? body.groups : undefined,
  })

  invalidateGameCache(slug)
  return { id }
})
