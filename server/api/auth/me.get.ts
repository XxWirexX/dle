import { findUserById, toPublicUser } from '~~/server/db/queries/users'
import { requireAuthPayload } from '~~/server/utils/session'

export default defineEventHandler(async (event) => {
  const payload = requireAuthPayload(event)
  const user = await findUserById(payload.userId)
  if (!user) {
    throw createError({ statusCode: 404, message: 'Utilisateur non trouvé' })
  }
  return { user: toPublicUser(user) }
})
