import { findUserByResetToken, updateUserPassword } from '~~/server/db/queries/users'
import { hashPassword } from '~~/server/utils/password'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { resetPasswordSchema } from '#shared/utils/validators'

export default defineEventHandler(async (event) => {
  const { token, password } = await readValidatedJsonBody(event, resetPasswordSchema)

  const user = await findUserByResetToken(token)
  if (!user) {
    throw createError({ statusCode: 400, message: 'Token invalide ou expiré' })
  }
  if (user.passwordResetExpires && user.passwordResetExpires < new Date()) {
    throw createError({ statusCode: 400, message: 'Token expiré, demande un nouveau lien' })
  }

  const passwordHash = await hashPassword(password)
  await updateUserPassword(user.id, passwordHash)

  return { message: 'Mot de passe mis à jour avec succès' }
})
