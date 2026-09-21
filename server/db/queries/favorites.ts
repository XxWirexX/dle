import { eq, and } from 'drizzle-orm'
import { db } from '../client'
import { favoriteGames } from '../schema'

export async function listFavoriteGameIds(userId: number): Promise<number[]> {
  const rows = await db.query.favoriteGames.findMany({
    where: eq(favoriteGames.userId, userId),
    columns: { gameId: true },
  })
  return rows.map((r) => r.gameId)
}

export async function toggleFavorite(userId: number, gameId: number): Promise<boolean> {
  const existing = await db.query.favoriteGames.findFirst({
    where: and(eq(favoriteGames.userId, userId), eq(favoriteGames.gameId, gameId)),
  })

  if (existing) {
    await db.delete(favoriteGames).where(eq(favoriteGames.id, existing.id))
    return false
  }

  await db.insert(favoriteGames).values({ userId, gameId })
  return true
}
