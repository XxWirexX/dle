import { z } from 'zod'
import { requireAuthPayload } from '~~/server/utils/session'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { getCachedGamePlayData } from '~~/server/utils/gameCache'
import { getTodayDateString, getDailyTarget } from '~~/server/utils/daily'
import { updateStats, findGameIdBySlug } from '~~/server/db/queries/stats'

const schema = z.object({ attemptCharacterIds: z.array(z.number().int()) })

// Contrairement au solo, le quotidien est une compétition implicite (même
// personnage pour tout le monde) : on ne fait pas confiance au client sur
// "j'ai gagné". Le client renvoie la liste ordonnée de ses tentatives, et
// le serveur revérifie lui-même si la dernière correspond à la vraie
// cible du jour et si le nombre d'essais est cohérent — sans avoir besoin
// de garder un état de session côté serveur entre les appels.
export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  const slug = getRouterParam(event, 'slug')!
  const { attemptCharacterIds } = await readValidatedJsonBody(event, schema)

  const game = await getCachedGamePlayData(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const gameRow = await findGameIdBySlug(slug)
  if (!gameRow) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  if (attemptCharacterIds.length > game.maxAttempts) {
    throw createError({ statusCode: 400, message: 'Nombre de tentatives invalide' })
  }
  if (!attemptCharacterIds.every((id) => game.characters.some((c) => c.id === id))) {
    throw createError({ statusCode: 400, message: 'Personnage inconnu dans les tentatives' })
  }

  // On ne restreint pas aux seules parties "vraiment terminées" (dernière
  // tentative == cible ou essais épuisés) : un abandon volontaire avant
  // la fin doit pouvoir se compter comme une défaite, et personne n'a
  // intérêt à déclarer une victoire qu'il n'a pas — seul `target.id` fait
  // foi pour `won`, jamais ce que le client prétend.
  const target = getDailyTarget(slug, game.characters, getTodayDateString())
  const won = attemptCharacterIds.includes(target.id)

  const stats = await updateStats(userId, gameRow.id, {
    won,
    attempts: attemptCharacterIds.length,
    isDaily: true,
  })

  return stats
})
