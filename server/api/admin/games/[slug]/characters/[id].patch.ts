import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/admin'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { getCachedGamePlayData, invalidateGameCache } from '~~/server/utils/gameCache'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { updateCharacter, growAttributeHints } from '~~/server/db/queries/games'
import { coerceAttributeValue } from '~~/server/utils/attributeValues'

const schema = z.object({
  name: z.string().trim().min(1).max(80),
  imageUrl: z.string().min(1),
  imagePublicId: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const slug = getRouterParam(event, 'slug')!
  const characterId = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(characterId)) throw createError({ statusCode: 400, message: 'Identifiant invalide' })

  const body = await readValidatedJsonBody(event, schema)

  const game = await getCachedGamePlayData(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  const gameRow = await findGameIdBySlug(slug)
  if (!gameRow) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const attributes = Object.fromEntries(
    game.attributes.map((attr) => [attr.key, coerceAttributeValue(attr, body.attributes[attr.key])]),
  )

  const updated = await updateCharacter(characterId, gameRow.id, {
    name: body.name,
    imageUrl: body.imageUrl,
    imagePublicId: body.imagePublicId ?? null,
    attributes,
  })
  if (!updated) throw createError({ statusCode: 404, message: 'Personnage introuvable dans ce jeu' })

  await growAttributeHints(game.attributes, attributes)

  invalidateGameCache(slug)
  return { ok: true }
})
