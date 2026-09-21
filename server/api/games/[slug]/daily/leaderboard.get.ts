import { findGameIdBySlug } from '~~/server/db/queries/stats'
import { getDailyLeaderboard } from '~~/server/db/queries/dailyLeaderboard'
import { getTodayDateString } from '~~/server/utils/daily'

// Public : classement de pseudos + scores sur le défi du jour, rien de
// sensible, pas besoin d'être connecté pour le consulter.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const game = await findGameIdBySlug(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const entries = await getDailyLeaderboard(game.id, getTodayDateString())
  return { entries, date: getTodayDateString() }
})
