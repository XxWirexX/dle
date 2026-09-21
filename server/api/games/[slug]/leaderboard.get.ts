import { getGameLeaderboard, findGameIdBySlug } from '~~/server/db/queries/stats'

// Public : un classement de pseudos + scores n'a rien de sensible, pas
// besoin d'être connecté pour le consulter.
export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const game = await findGameIdBySlug(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  setResponseHeader(event, 'Cache-Control', 'public, max-age=60')
  return { entries: await getGameLeaderboard(game.id) }
})
