import type { Attribute } from '#shared/types/game'
import type { Attempt } from '~/composables/useGuessGame'

export function generateShareText(opts: {
  gameName: string
  dayNumber: number
  attempts: Attempt[]
  attributes: Attribute[]
  maxAttempts: number
  won: boolean
  url: string
}): string {
  const { gameName, dayNumber, attempts, attributes, maxAttempts, won, url } = opts
  const count = won ? attempts.length : 'X'

  // `attempts` est stocké plus récent en premier (voir useGuessGame) ; on
  // reprend l'ordre chronologique pour la grille, comme sur Wordle.
  const grid = [...attempts].reverse().map((attempt) =>
    attributes.map((attr) => {
      const fb = attempt.feedback[attr.key]
      if (fb?.type === 'correct') return '🟩'
      if (fb?.type === 'close') return '🟨'
      return '⬛'
    }).join(''),
  ).join('\n')

  return `DLE - ${gameName} #${dayNumber}\n${count}/${maxAttempts}\n\n${grid}\n\n${url}`
}
