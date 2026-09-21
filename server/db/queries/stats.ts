import { eq, and, desc, gt } from 'drizzle-orm'
import { db } from '../client'
import { userGameStats, games } from '../schema'

const EMPTY_STATS = {
  gamesPlayed: 0, wins: 0, currentStreak: 0, maxStreak: 0, totalAttempts: 0,
  bestAttempts: null as number | null,
  dailyPlayed: 0, dailyWins: 0, dailyStreak: 0, dailyMaxStreak: 0, lastDailyDate: null as string | null,
  multiplayerPlayed: 0, multiplayerWins: 0,
}

export async function getStats(userId: number, gameId: number) {
  const row = await db.query.userGameStats.findFirst({
    where: and(eq(userGameStats.userId, userId), eq(userGameStats.gameId, gameId)),
  })
  return row ?? EMPTY_STATS
}

export interface StatsRow {
  gameId: number
  gameSlug: string
  gameName: string
  gamesPlayed: number
  wins: number
  currentStreak: number
  maxStreak: number
  totalAttempts: number
  bestAttempts: number | null
  dailyPlayed: number
  dailyWins: number
  dailyStreak: number
  dailyMaxStreak: number
  multiplayerPlayed: number
  multiplayerWins: number
}

export async function getAllStatsForUser(userId: number): Promise<StatsRow[]> {
  const rows = await db.query.userGameStats.findMany({
    where: eq(userGameStats.userId, userId),
    with: { game: { columns: { id: true, slug: true, name: true } } },
  })
  return rows
    .filter((r) => r.game)
    .map((r) => ({
      gameId: r.gameId,
      gameSlug: r.game!.slug,
      gameName: r.game!.name,
      gamesPlayed: r.gamesPlayed,
      wins: r.wins,
      currentStreak: r.currentStreak,
      maxStreak: r.maxStreak,
      totalAttempts: r.totalAttempts,
      bestAttempts: r.bestAttempts,
      dailyPlayed: r.dailyPlayed,
      dailyWins: r.dailyWins,
      dailyStreak: r.dailyStreak,
      dailyMaxStreak: r.dailyMaxStreak,
      multiplayerPlayed: r.multiplayerPlayed,
      multiplayerWins: r.multiplayerWins,
    }))
}

interface UpdateStatsOptions {
  won: boolean
  attempts?: number
  isDaily?: boolean
  isMultiplayer?: boolean
}

function todayStr(): string {
  return new Date().toISOString().split('T')[0]!
}

export async function updateStats(userId: number, gameId: number, opts: UpdateStatsOptions) {
  const current = await getStats(userId, gameId)
  const attempts = opts.attempts ?? 0

  const gamesPlayed = current.gamesPlayed + 1
  const wins = current.wins + (opts.won ? 1 : 0)
  const currentStreak = opts.won ? current.currentStreak + 1 : 0
  const maxStreak = Math.max(current.maxStreak, currentStreak)
  const totalAttempts = current.totalAttempts + attempts
  const bestAttempts = opts.won && attempts > 0
    ? (current.bestAttempts === null ? attempts : Math.min(current.bestAttempts, attempts))
    : current.bestAttempts
  const multiplayerPlayed = current.multiplayerPlayed + (opts.isMultiplayer ? 1 : 0)
  const multiplayerWins = current.multiplayerWins + (opts.isMultiplayer && opts.won ? 1 : 0)

  // Le quotidien ne compte qu'une fois par jour, même si l'endpoint est
  // rappelé (double clic, retry réseau...).
  let { dailyPlayed, dailyWins, dailyStreak, dailyMaxStreak, lastDailyDate } = current
  const today = todayStr()
  if (opts.isDaily && lastDailyDate !== today) {
    dailyPlayed += 1
    dailyWins += opts.won ? 1 : 0
    dailyStreak = opts.won ? dailyStreak + 1 : 0
    dailyMaxStreak = Math.max(dailyMaxStreak, dailyStreak)
    lastDailyDate = today
  }

  const values = {
    userId, gameId, gamesPlayed, wins, currentStreak, maxStreak, totalAttempts, bestAttempts,
    dailyPlayed, dailyWins, dailyStreak, dailyMaxStreak, lastDailyDate,
    multiplayerPlayed, multiplayerWins,
  }

  await db.insert(userGameStats).values(values).onConflictDoUpdate({
    target: [userGameStats.userId, userGameStats.gameId],
    set: values,
  })

  return values
}

export function findGameIdBySlug(slug: string) {
  return db.query.games.findFirst({ where: eq(games.slug, slug), columns: { id: true, maxAttempts: true } })
}

export interface GameLeaderboardEntry {
  userId: number
  username: string
  avatarColor: string
  avatarImageUrl: string | null
  wins: number
  gamesPlayed: number
  maxStreak: number
}

// Classement des joueurs sur un jeu donné : victoires d'abord, puis
// meilleure série pour départager — seuls ceux qui ont au moins une
// victoire apparaissent (pas d'intérêt à classer des 0 partout).
export async function getGameLeaderboard(gameId: number, limit = 10): Promise<GameLeaderboardEntry[]> {
  const rows = await db.query.userGameStats.findMany({
    where: and(eq(userGameStats.gameId, gameId), gt(userGameStats.wins, 0)),
    orderBy: [desc(userGameStats.wins), desc(userGameStats.maxStreak)],
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
      wins: r.wins,
      gamesPlayed: r.gamesPlayed,
      maxStreak: r.maxStreak,
    }))
}
