import type { H3Event } from 'h3'
import { requireAuthPayload } from './session'
import { findUserById } from '../db/queries/users'

// Vérifié en base à chaque appel plutôt que via une claim dans le JWT :
// le statut admin ne doit pas survivre 7 jours (durée de vie du token) si
// jamais il est retiré, et ces routes sont assez rares pour se permettre
// l'aller-retour DB.
export async function requireAdmin(event: H3Event): Promise<number> {
  const { userId } = requireAuthPayload(event)
  const user = await findUserById(userId)
  if (!user?.isAdmin) {
    throw createError({ statusCode: 403, message: 'Réservé aux administrateurs' })
  }
  return userId
}
