import { z } from 'zod'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { rateLimit } from '~~/server/utils/rateLimit'
import { findUserByDiscordId, createDiscordUser, toPublicUser } from '~~/server/db/queries/users'
import { signToken, setAuthCookieForDiscordActivity } from '~~/server/utils/session'

const schema = z.object({
  access_token: z.string().min(1),
})

interface DiscordMe {
  id: string
  username: string
  global_name: string | null
  avatar: string | null
}

/**
 * Étape 3 du flow OAuth2 Activity Discord : vérifie l'`access_token` auprès
 * de Discord lui-même (jamais l'identité déclarée par le client), relie ou
 * crée le compte DLE correspondant, et ouvre une session normale — tout le
 * reste du site (multijoueur inclus) fonctionne ensuite sans modification.
 */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'discord-activity-login', 20, 15 * 60 * 1000)

  const { access_token } = await readValidatedJsonBody(event, schema)

  const res = await fetch('https://discord.com/api/v10/users/@me', {
    headers: { Authorization: `Bearer ${access_token}` },
  })
  if (!res.ok) {
    throw createError({ statusCode: 401, message: 'Token Discord invalide' })
  }
  const me = await res.json() as DiscordMe

  let user = await findUserByDiscordId(me.id)
  if (!user) {
    const avatarImageUrl = me.avatar
      ? `https://cdn.discordapp.com/avatars/${me.id}/${me.avatar}.webp`
      : null
    user = await createDiscordUser(me.id, me.global_name || me.username, avatarImageUrl)
  }

  const token = signToken({ userId: user.id, username: user.username })
  setAuthCookieForDiscordActivity(event, token)

  return { user: toPublicUser(user) }
})
