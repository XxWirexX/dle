import { findUserByEmail, createPasswordResetToken } from '~~/server/db/queries/users'
import { sendPasswordResetEmail } from '~~/server/utils/email'
import { rateLimit } from '~~/server/utils/rateLimit'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { forgotPasswordSchema } from '#shared/utils/validators'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'forgot-password', 10, 15 * 60 * 1000)

  const { email } = await readValidatedJsonBody(event, forgotPasswordSchema)
  const user = await findUserByEmail(email)

  // Toujours le même message, que le compte existe ou non : on ne
  // confirme jamais l'existence d'un email à un client non authentifié.
  if (user) {
    const token = await createPasswordResetToken(user.id)
    await sendPasswordResetEmail(email, user.username, token)
  }

  return { message: 'Si cet email existe, un lien de réinitialisation a été envoyé' }
})
