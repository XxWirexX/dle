import { getCachedGamePlayData } from '~~/server/utils/gameCache'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const data = await getCachedGamePlayData(slug)
  if (!data) {
    throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  }
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return data
})
