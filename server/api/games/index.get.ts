import { getCachedGameSummaries } from '~~/server/utils/gameCache'

export default defineEventHandler(async (event) => {
  // Contenu statique côté serveur (voir gameCache) : cache HTTP court
  // côté client/proxy par-dessus, sans dépendre de revalidation.
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return getCachedGameSummaries()
})
