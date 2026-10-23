import type { Character } from '#shared/types/game'

// Fuseau de référence pour le défi du jour : le site est francophone, donc
// "minuit" doit correspondre à minuit à Paris, pas minuit UTC (jusqu'ici en
// UTC, le défi changeait en réalité à 1h ou 2h du matin heure française,
// selon l'heure d'été/hiver — Intl gère cette bascule automatiquement).
const DAILY_TIMEZONE = 'Europe/Paris'

export function getTodayDateString(): string {
  // "en-CA" rend directement le format YYYY-MM-DD, pas besoin de réassembler
  // les parts nous-mêmes.
  return new Intl.DateTimeFormat('en-CA', { timeZone: DAILY_TIMEZONE }).format(new Date())
}

const EPOCH = new Date('2024-01-01T00:00:00Z').getTime()

export function getDayNumber(dateStr: string): number {
  const today = new Date(`${dateStr}T00:00:00Z`).getTime()
  return Math.floor((today - EPOCH) / (1000 * 60 * 60 * 24))
}

function seededHash(seed: string): number {
  let hash = 0
  for (let i = 0; i < seed.length; i++) {
    hash = (Math.imul(31, hash) + seed.charCodeAt(i)) | 0
  }
  return Math.abs(hash)
}

/**
 * Cible du défi du jour, déterministe par (slug, date) : jamais renvoyée
 * telle quelle au client — seul le feedback calculé côté serveur sort de
 * `/daily/guess`, pour ne pas fuiter la réponse dans l'onglet réseau.
 */
export function getDailyTarget(slug: string, characters: Character[], dateStr: string): Character {
  const index = seededHash(`${slug}-${dateStr}`) % characters.length
  return characters[index]!
}
