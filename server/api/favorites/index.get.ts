import { requireAuthPayload } from '~~/server/utils/session'
import { listFavoriteGameIds } from '~~/server/db/queries/favorites'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  return { gameIds: await listFavoriteGameIds(userId) }
})
