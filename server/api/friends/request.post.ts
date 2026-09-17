import { z } from 'zod'
import { requireAuthPayload } from '~~/server/utils/session'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { findUserByUsernameForFriends, sendFriendRequest, findFriendship } from '~~/server/db/queries/friends'
import { rateLimit } from '~~/server/utils/rateLimit'

const schema = z.object({ username: z.string().min(2).max(20) })

export default defineEventHandler(async (event) => {
  rateLimit(event, 'friend-request', 30, 15 * 60 * 1000)
  const { userId } = requireAuthPayload(event)
  const { username } = await readValidatedJsonBody(event, schema)

  const target = await findUserByUsernameForFriends(username)
  if (!target) throw createError({ statusCode: 404, message: 'Utilisateur introuvable' })
  if (target.id === userId) throw createError({ statusCode: 400, message: 'Tu ne peux pas t\'ajouter toi-même' })

  const existing = await findFriendship(userId, target.id)
  if (existing) {
    if (existing.status === 'accepted') throw createError({ statusCode: 400, message: 'Déjà ami avec cet utilisateur' })
    throw createError({ statusCode: 400, message: 'Demande déjà en attente' })
  }

  const row = await sendFriendRequest(userId, target.id)
  return { friendshipId: row.id }
})
