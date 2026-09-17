import { z } from 'zod'
import { requireAuthPayload } from '~~/server/utils/session'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { updateStats, findGameIdBySlug } from '~~/server/db/queries/stats'

const schema = z.object({
  won: z.boolean(),
  attempts: z.number().int().min(0).optional(),
})

// Solo uniquement : la partie se joue et se juge entièrement côté client
// (pas d'enjeu compétitif, personne d'autre n'est affecté), donc on fait
// confiance au résultat déclaré — comme dans la v1. Le quotidien et le
// multijoueur, eux, ont leur propre endpoint qui vérifie le résultat
// plutôt que de le croire sur parole.
export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  const slug = getRouterParam(event, 'slug')!
  const { won, attempts } = await readValidatedJsonBody(event, schema)

  const game = await findGameIdBySlug(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const stats = await updateStats(userId, game.id, { won, attempts })
  return stats
})
