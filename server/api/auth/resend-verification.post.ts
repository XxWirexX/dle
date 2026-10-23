import { findUserById, resendVerificationToken } from '~~/server/db/queries/users'
import { requireAuthPayload } from '~~/server/utils/session'
import { sendVerificationEmail } from '~~/server/utils/email'
import { rateLimit } from '~~/server/utils/rateLimit'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'resend-verification', 10, 15 * 60 * 1000)
  const payload = requireAuthPayload(event)

  const user = await findUserById(payload.userId)
  if (!user) {
    throw createError({ statusCode: 404, message: 'Utilisateur non trouvé' })
  }
  if (user.emailVerified) {
    throw createError({ statusCode: 400, message: 'Email déjà vérifié' })
  }

  const token = await resendVerificationToken(user.id)
  await sendVerificationEmail(user.email, user.username, token, getRequestURL(event).origin)

  return { message: 'Email de vérification envoyé' }
})
