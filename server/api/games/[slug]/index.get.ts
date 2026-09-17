import { getCachedGameDetail } from '~~/server/utils/gameCache'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const detail = await getCachedGameDetail(slug)
  if (!detail) {
    throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  }
  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return detail
})
