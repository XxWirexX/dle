import { requireAuthPayload } from '~~/server/utils/session'
import { listAcceptedFriends, listIncomingRequests, listOutgoingRequests } from '~~/server/db/queries/friends'
import { presence } from '~~/server/utils/multiplayer/presence'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)

  const [friends, incoming, outgoing] = await Promise.all([
    listAcceptedFriends(userId),
    listIncomingRequests(userId),
    listOutgoingRequests(userId),
  ])

  return {
    friends: friends.map((f) => ({ ...f, online: presence.isOnline(f.userId) })),
    incoming,
    outgoing,
  }
})
