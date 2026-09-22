import { eq, and, asc } from 'drizzle-orm'
import { db } from '../client'
import { dailyCompletions } from '../schema'

interface RecordDailyCompletionOptions {
  userId: number
  gameId: number
  date: string
  attempts: number
  won: boolean
}

// Un seul enregistrement par joueur/jeu/jour — on ne fait rien si un appel
// précédent a déjà tout consigné (le premier passage fait foi, pas la peine
// d'écraser avec une nouvelle tentative de rappel de l'endpoint).
export async function recordDailyCompletion(opts: RecordDailyCompletionOptions) {
  await db.insert(dailyCompletions).values(opts).onConflictDoNothing()
}

export interface MyDailyCompletion {
  attempts: number
  won: boolean
}

// Sert à bloquer le rejeu du défi du jour côté client : si une ligne
// existe pour (user, jeu, date), la page /daily doit afficher le résultat
// déjà obtenu plutôt que de laisser reguesser.
export async function getMyDailyCompletion(userId: number, gameId: number, date: string): Promise<MyDailyCompletion | null> {
  const row = await db.query.dailyCompletions.findFirst({
    where: and(eq(dailyCompletions.userId, userId), eq(dailyCompletions.gameId, gameId), eq(dailyCompletions.date, date)),
    columns: { attempts: true, won: true },
  })
  return row ?? null
}

export interface DailyLeaderboardEntry {
  userId: number
  username: string
  avatarColor: string
  avatarImageUrl: string | null
  attempts: number
  completedAt: string
}

// Classement du jour : uniquement ceux qui ont trouvé, triés par nombre
// d'essais croissant puis par heure de résolution (le plus rapide gagne
// à essais égaux).
export async function getDailyLeaderboard(gameId: number, date: string, limit = 20): Promise<DailyLeaderboardEntry[]> {
  const rows = await db.query.dailyCompletions.findMany({
    where: and(eq(dailyCompletions.gameId, gameId), eq(dailyCompletions.date, date), eq(dailyCompletions.won, true)),
    orderBy: [asc(dailyCompletions.attempts), asc(dailyCompletions.completedAt)],
    limit,
    with: { user: { columns: { id: true, username: true, avatarColor: true, avatarImageUrl: true } } },
  })

  return rows
    .filter((r) => r.user)
    .map((r) => ({
      userId: r.userId,
      username: r.user!.username,
      avatarColor: r.user!.avatarColor,
      avatarImageUrl: r.user!.avatarImageUrl,
      attempts: r.attempts,
      completedAt: r.completedAt.toISOString(),
    }))
}
