import type { Character } from '#shared/types/game'

export function getTodayDateString(): string {
  return new Date().toISOString().split('T')[0]!
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
