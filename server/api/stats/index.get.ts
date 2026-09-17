import { requireAuthPayload } from '~~/server/utils/session'
import { getAllStatsForUser } from '~~/server/db/queries/stats'

export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)
  const rows = await getAllStatsForUser(userId)

  const totals = rows.reduce((acc, r) => {
    acc.totalPlayed += r.gamesPlayed
    acc.totalWins += r.wins
    acc.totalAttempts += r.totalAttempts
    acc.dailyPlayed += r.dailyPlayed
    acc.dailyWins += r.dailyWins
    acc.multiplayerPlayed += r.multiplayerPlayed
    acc.multiplayerWins += r.multiplayerWins
    acc.bestStreak = Math.max(acc.bestStreak, r.maxStreak)
    return acc
  }, { totalPlayed: 0, totalWins: 0, totalAttempts: 0, dailyPlayed: 0, dailyWins: 0, multiplayerPlayed: 0, multiplayerWins: 0, bestStreak: 0 })

  // "Solo" = ni quotidien ni multijoueur — les deux ont leur propre compteur
  // dédié mais incrémentent aussi gamesPlayed/wins, donc il faut les
  // soustraire tous les deux pour ne garder que le vrai mode solo.
  const soloPlayed = totals.totalPlayed - totals.dailyPlayed - totals.multiplayerPlayed
  const soloWins = totals.totalWins - totals.dailyWins - totals.multiplayerWins

  return {
    global: {
      totalPlayed: totals.totalPlayed,
      totalWins: totals.totalWins,
      winRate: totals.totalPlayed > 0 ? Math.round((totals.totalWins / totals.totalPlayed) * 100) : 0,
      soloPlayed,
      soloWins,
      soloWinRate: soloPlayed > 0 ? Math.round((soloWins / soloPlayed) * 100) : 0,
      multiplayerPlayed: totals.multiplayerPlayed,
      multiplayerWins: totals.multiplayerWins,
      multiplayerWinRate: totals.multiplayerPlayed > 0 ? Math.round((totals.multiplayerWins / totals.multiplayerPlayed) * 100) : 0,
      avgAttempts: totals.totalPlayed > 0 ? (totals.totalAttempts / totals.totalPlayed).toFixed(1) : '0',
      bestStreak: totals.bestStreak,
    },
    byGame: rows,
  }
})
