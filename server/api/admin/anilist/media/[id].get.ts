import { requireAdmin } from '~~/server/utils/admin'
import { getAnilistMediaCharacters } from '~~/server/utils/anilist'

// Peut prendre jusqu'à une minute pour une très longue série (une page de
// 25 persos par appel, avec une pause entre chaque pour la limite AniList).
export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const id = Number(getRouterParam(event, 'id'))
  if (!Number.isInteger(id) || id <= 0) {
    throw createError({ statusCode: 400, message: 'Identifiant AniList invalide' })
  }
  return getAnilistMediaCharacters(id)
})
