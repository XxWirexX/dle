import { getCachedGamePlayData } from '~~/server/utils/gameCache'
import { getTodayDateString, getDayNumber } from '~~/server/utils/daily'
import { getAuthPayload } from '~~/server/utils/session'
import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { getMyDailyCompletion } from '~~/server/db/queries/dailyLeaderboard'

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

  // Si connecté, on dit tout de suite au client s'il a déjà fait le défi
  // aujourd'hui — sinon la page /daily le laisserait reguesser à l'infini,
  // le seul rempart contre ça étant le "une fois par jour" côté stats,
  // invisible pour l'affichage.
  const auth = getAuthPayload(event)
  let myCompletion = null
  if (auth) {
    const gameRow = await findGameIdBySlug(slug)
    if (gameRow) myCompletion = await getMyDailyCompletion(auth.userId, gameRow.id, date)
  }

  return { date, dayNumber: getDayNumber(date), maxAttempts: game.maxAttempts, myCompletion }
})
