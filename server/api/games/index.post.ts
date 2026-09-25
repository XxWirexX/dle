import { z } from 'zod'
import { requireAuthPayload } from '~~/server/utils/session'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { createCustomGame, type CreateGameAttributeInput, type CreateGameCharacterInput } from '~~/server/db/queries/games'
import { invalidateGameCache } from '~~/server/utils/gameCache'
import { coerceAttributeValue } from '~~/server/utils/attributeValues'

const attributeSchema = z.object({
  key: z.string().regex(/^[a-z0-9_]+$/).min(1).max(40),
  label: z.string().trim().min(1).max(60),
  type: z.enum(['text', 'number', 'ordered', 'multiple', 'text-group', 'boolean']),
  order: z.array(z.string().trim().min(1)).max(50).optional(),
  groups: z.array(z.array(z.string().trim().min(1)).min(1)).max(30).optional(),
}).refine((a) => a.type !== 'ordered' || (a.order && a.order.length >= 2), {
  message: 'Un attribut "ordonné" a besoin d\'au moins 2 valeurs',
}).refine((a) => a.type !== 'text-group' || (a.groups && a.groups.length >= 1), {
  message: 'Un attribut "groupe" a besoin d\'au moins un groupe',
})

const characterSchema = z.object({
  name: z.string().trim().min(1).max(80),
  imageUrl: z.string().min(1),
  imagePublicId: z.string().nullable().optional(),
  attributes: z.record(z.string(), z.unknown()),
})

const createGameSchema = z.object({
  name: z.string().trim().min(2).max(100),
  iconUrl: z.string().nullable().optional(),
  iconPublicId: z.string().nullable().optional(),
  backgroundUrl: z.string().nullable().optional(),
  backgroundPublicId: z.string().nullable().optional(),
  maxAttempts: z.number().int().min(4).max(40),
  visibility: z.enum(['public', 'private']),
  attributes: z.array(attributeSchema).min(1).max(15),
  characters: z.array(characterSchema).min(4).max(500),
})

// Clés déduites des labels (uniques au sein d'un même DLE) plutôt que
// saisies à la main : moins d'erreurs de frappe côté client, et les clés
// n'ont besoin d'exister que pour relier attributs et valeurs personnage.
function dedupeKeys(attrs: { key: string }[]): void {
  const seen = new Set<string>()
  for (const a of attrs) {
    if (seen.has(a.key)) throw createError({ statusCode: 400, message: 'Deux attributs ont la même clé — change leur libellé' })
    seen.add(a.key)
  }
}

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  const body = await readValidatedJsonBody(event, createGameSchema)

  const attributeInputs: CreateGameAttributeInput[] = body.attributes.map((a) => ({
    key: a.key,
    label: a.label,
    type: a.type,
    order: a.type === 'ordered' ? a.order : undefined,
    groups: a.type === 'text-group' ? a.groups : undefined,
  }))
  dedupeKeys(attributeInputs)

  const characterInputs: CreateGameCharacterInput[] = body.characters.map((c) => ({
    name: c.name,
    imageUrl: c.imageUrl,
    imagePublicId: c.imagePublicId ?? null,
    attributes: Object.fromEntries(
      attributeInputs.map((attr) => [attr.key, coerceAttributeValue(attr, c.attributes[attr.key])]),
    ),
  }))

  const { slug } = await createCustomGame({
    ownerId: userId,
    name: body.name,
    iconUrl: body.iconUrl ?? null,
    iconPublicId: body.iconPublicId ?? null,
    backgroundUrl: body.backgroundUrl ?? null,
    backgroundPublicId: body.backgroundPublicId ?? null,
    maxAttempts: body.maxAttempts,
    visibility: body.visibility,
    attributes: attributeInputs,
    characters: characterInputs,
  })

  invalidateGameCache()
  return { slug }
})
