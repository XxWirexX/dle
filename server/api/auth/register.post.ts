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

  await sendVerificationEmail(email, username, verificationToken)

  const token = signToken({ userId: row.id, username: row.username })
  setAuthCookie(event, token)

  setResponseStatus(event, 201)
  return { user: toPublicUser(row) }
})
