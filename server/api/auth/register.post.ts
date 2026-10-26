import {
  createUser,
  findUserByEmail,
  findUserByUsername,
  toPublicUser,
} from '~~/server/db/queries/users'
import { hashPassword } from '~~/server/utils/password'
import { signToken, setAuthCookie } from '~~/server/utils/session'
import { sendVerificationEmail } from '~~/server/utils/email'
import { rateLimit } from '~~/server/utils/rateLimit'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { registerSchema } from '#shared/utils/validators'

export default defineEventHandler(async (event) => {
  rateLimit(event, 'register', 10, 15 * 60 * 1000)

  const { email, password, username } = await readValidatedJsonBody(event, registerSchema)

  if (await findUserByEmail(email)) {
    throw createError({ statusCode: 400, message: 'Cet email est déjà utilisé' })
  }
  if (await findUserByUsername(username)) {
    throw createError({ statusCode: 400, message: 'Ce pseudo est déjà pris' })
  }

  const passwordHash = await hashPassword(password)
  const { row, verificationToken } = await createUser(email, passwordHash, username)

  // Un envoi SMTP en échec ne doit jamais empêcher la création du compte
  // (déjà actée en base à ce stade) ni bloquer la connexion qui suit —
  // seul le mail de vérification est perdu, l'utilisateur peut en
  // redemander un via /resend-verification.
  try {
    await sendVerificationEmail(email, username, verificationToken, getRequestURL(event, { xForwardedHost: true, xForwardedProto: true }).origin)
  } catch (err) {
    console.error('[register] Échec d\'envoi de l\'email de vérification:', err)
  }

  const token = signToken({ userId: row.id, username: row.username })
  setAuthCookie(event, token)

  setResponseStatus(event, 201)
  return { user: toPublicUser(row) }
})
