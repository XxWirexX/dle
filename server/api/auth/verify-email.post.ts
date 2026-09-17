import { findUserByVerificationToken, verifyUserEmail } from '~~/server/db/queries/users'
import { z } from 'zod'
import { readValidatedJsonBody } from '~~/server/utils/validate'

const schema = z.object({ token: z.string().min(1) })

export default defineEventHandler(async (event) => {
  const { token } = await readValidatedJsonBody(event, schema)

  const user = await findUserByVerificationToken(token)
  if (!user) {
    throw createError({ statusCode: 400, message: 'Token invalide ou expiré' })
  }
  if (user.verificationTokenExpires && user.verificationTokenExpires < new Date()) {
    throw createError({ statusCode: 400, message: 'Token expiré, demande un nouveau lien' })
  }

  await verifyUserEmail(user.id)
  return { message: 'Email vérifié avec succès' }
})
