import { getCachedGamePlayData } from '~~/server/utils/gameCache'
import { getTodayDateString, getDailyTarget } from '~~/server/utils/daily'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const game = await getCachedGamePlayData(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  return { target: getDailyTarget(slug, game.characters, getTodayDateString()) }
})
