/**
 * Rotation déterministe : même jeu mis en avant pour tout le monde un jour
 * donné, qui change automatiquement le lendemain — pas de champ "featured"
 * à maintenir à la main en DB.
 */
export function featuredGameIndex(gameCount: number, date: Date = new Date()): number {
  if (gameCount <= 0) return 0
  const dayNumber = Math.floor(date.getTime() / 86400000)
  return dayNumber % gameCount
}
