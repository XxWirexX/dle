import { z } from 'zod'
import { requireAuthPayload } from '~~/server/utils/session'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { respondToRequest } from '~~/server/db/queries/friends'
import { presence } from '~~/server/utils/multiplayer/presence'

const schema = z.object({ accept: z.boolean() })

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  const friendshipId = Number(getRouterParam(event, 'id'))
  const { accept } = await readValidatedJsonBody(event, schema)

  const row = await respondToRequest(friendshipId, userId, accept)
  if (accept && !row) throw createError({ statusCode: 404, message: 'Demande introuvable' })

  if (row) {
    presence.notifyUser(row.requesterId, 'friend:update', {})
  }

  return { success: true }
})
