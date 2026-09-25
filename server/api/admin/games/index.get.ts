import { requireAdmin } from '~~/server/utils/admin'
import { listAllGames } from '~~/server/db/queries/games'

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  return listAllGames()
})
