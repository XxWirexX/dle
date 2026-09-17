import type { Character, GuessFeedback } from '#shared/types/game'

export interface Attempt {
  character: Character
  feedback: GuessFeedback
}

/** État partagé par les modes de jeu à devinettes (solo, daily, plus tard multi). */
export function useGuessGame(maxAttempts: number) {
  const attempts = ref<Attempt[]>([])
  const gameOver = ref(false)
  const won = ref(false)

  function addAttempt(character: Character, feedback: GuessFeedback, isCorrect: boolean) {
    attempts.value.unshift({ character, feedback })
    if (isCorrect) {
      gameOver.value = true
      won.value = true
    } else if (attempts.value.length >= maxAttempts) {
      gameOver.value = true
      won.value = false
    }
  }

  function reset() {
    attempts.value = []
    gameOver.value = false
    won.value = false
  }

  function forfeit() {
    gameOver.value = true
    won.value = false
  }

  const guessedIds = computed(() => attempts.value.map((a) => a.character.id))

  return { attempts, gameOver, won, addAttempt, reset, forfeit, guessedIds }
}
