import { getCachedGamePlayData } from '~~/server/utils/gameCache'
import { getTodayDateString, getDayNumber } from '~~/server/utils/daily'

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const game = await getCachedGamePlayData(slug)
  if (!game) {
    throw createError({ statusCode: 404, message: 'Jeu introuvable' })
  }
  if (game.characters.length === 0) {
    throw createError({ statusCode: 400, message: 'Pas de personnages' })
  }

  const date = getTodayDateString()
  return { date, dayNumber: getDayNumber(date), maxAttempts: game.maxAttempts }
})
