import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/admin'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { invalidateGameCache } from '~~/server/utils/gameCache'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { updateAttribute } from '~~/server/db/queries/games'

const schema = z.object({
  label: z.string().trim().min(1).max(60),
  type: z.enum(['text', 'number', 'ordered', 'multiple', 'text-group', 'boolean']),
  order: z.array(z.string().trim().min(1)).max(50).optional(),
  hints: z.array(z.string().trim().min(1)).max(50).optional(),
  groups: z.array(z.array(z.string().trim().min(1)).min(1)).max(30).optional(),
}).refine((a) => a.type !== 'ordered' || (a.order && a.order.length >= 2), {
  message: 'Un attribut "ordonné" a besoin d\'au moins 2 valeurs',
}).refine((a) => a.type !== 'text-group' || (a.groups && a.groups.length >= 1), {
  message: 'Un attribut "groupe" a besoin d\'au moins un groupe',
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const attributeId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(attributeId)) throw createError({ statusCode: 400, message: 'Identifiant invalide' })

  const body = await readValidatedJsonBody(event, schema)

  const gameRow = await findGameIdBySlug(slug)
  if (!gameRow) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const updated = await updateAttribute(attributeId, gameRow.id, {
    label: body.label,
    type: body.type,
    order: body.type === 'ordered' ? body.order : undefined,
    hints: body.hints,
    groups: body.type === 'text-group' ? body.groups : undefined,
  })
  if (!updated) throw createError({ statusCode: 404, message: 'Attribut introuvable dans ce jeu' })

  invalidateGameCache(slug)
  return { ok: true }
})
