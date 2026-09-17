import { z } from 'zod'
import { getCachedGamePlayData } from '~~/server/utils/gameCache'
import { getTodayDateString, getDailyTarget } from '~~/server/utils/daily'
import { computeGuessFeedback } from '#shared/utils/feedback'
import { readValidatedJsonBody } from '~~/server/utils/validate'

const schema = z.object({ characterId: z.number().int() })

export default defineEventHandler(async (event) => {
  const slug = getRouterParam(event, 'slug')!
  const { characterId } = await readValidatedJsonBody(event, schema)

  const game = await getCachedGamePlayData(slug)
  if (!game) throw createError({ statusCode: 404, message: 'Jeu introuvable' })

  const guess = game.characters.find((c) => c.id === characterId)
  if (!guess) throw createError({ statusCode: 400, message: 'Personnage inconnu' })

  const target = getDailyTarget(slug, game.characters, getTodayDateString())
  const feedback = computeGuessFeedback(guess, target, game.attributes)

  return { feedback, isCorrect: guess.id === target.id }
})
