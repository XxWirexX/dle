import { findUserByEmail, toPublicUser } from '~~/server/db/queries/users'
import { verifyPassword } from '~~/server/utils/password'
import { signToken, setAuthCookie } from '~~/server/utils/session'
import { rateLimit } from '~~/server/utils/rateLimit'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { loginSchema } from '#shared/utils/validators'

export default defineEventHandler(async (event) => {
  // Deux limiteurs superposés comme dans la v1 : un large pour éviter le
  // spam général, un plus strict qui ne compte que les échecs pour freiner
  // le brute-force sans gêner un utilisateur légitime qui retape son mdp.
  rateLimit(event, 'login', 20, 15 * 60 * 1000)

  const { email, password } = await readValidatedJsonBody(event, loginSchema)

  const user = await findUserByEmail(email)
  if (!user || !(await verifyPassword(password, user.passwordHash))) {
    rateLimit(event, 'login-failed', 5, 60 * 60 * 1000)
    throw createError({ statusCode: 401, message: 'Email ou mot de passe incorrect' })
  }

  const token = signToken({ userId: user.id, username: user.username })
  setAuthCookie(event, token)

  return { user: toPublicUser(user) }
})
