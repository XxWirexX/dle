import { z } from 'zod'
import { readValidatedJsonBody } from '~~/server/utils/validate'
import { rateLimit } from '~~/server/utils/rateLimit'

const schema = z.object({
  code: z.string().min(1),
})

/**
 * Étape 2 du flow OAuth2 Activity Discord : échange le `code` obtenu côté
 * client (SDK `commands.authorize`) contre un `access_token`, avec le
 * `client_secret` qui ne doit jamais quitter le serveur. Voir
 * activity-login.post.ts pour l'étape suivante (identité -> session DLE).
 */
export default defineEventHandler(async (event) => {
  rateLimit(event, 'discord-token', 20, 15 * 60 * 1000)

  const config = useRuntimeConfig()
  if (!config.public.discordClientId || !config.discordClientSecret) {
    throw createError({ statusCode: 503, message: "L'Activity Discord n'est pas configurée" })
  }

  const { code } = await readValidatedJsonBody(event, schema)

  const res = await fetch('https://discord.com/api/oauth2/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.public.discordClientId,
      client_secret: config.discordClientSecret,
      grant_type: 'authorization_code',
      code,
    }),
  })

  if (!res.ok) {
    throw createError({ statusCode: 502, message: "Échec de l'échange du code Discord" })
  }

  const data = await res.json() as { access_token: string }
  return { access_token: data.access_token }
})
