import { requireAuthPayload } from '~~/server/utils/session'
import { removeFriendship } from '~~/server/db/queries/friends'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  const friendshipId = Number(getRouterParam(event, 'id'))

  await removeFriendship(userId, friendshipId)
  return { success: true }
})
