import { requireAuthPayload } from '~~/server/utils/session'
import { listGamesOwnedBy } from '~~/server/db/queries/games'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  return listGamesOwnedBy(userId)
})
