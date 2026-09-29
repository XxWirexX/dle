import type { Character, GuessFeedback, FieldFeedback } from './game'

export type RoomStatus = 'waiting' | 'playing' | 'finished'
export type RoomMode = 'classic' | 'hard'

export interface RoomPlayerInfo {
  socketId: string
  userId: number
  username: string
  score: number
  connected: boolean
}

export interface FeedAttempt {
  socketId: string
  username: string
  character: Character
  feedback: GuessFeedback
  isCorrect: boolean
}

export interface LastGuess {
  character: Character
  feedback: GuessFeedback
  isCorrect: boolean
}

export interface RoomSnapshot {
  id: string
  slug: string
  gameName: string
  backgroundUrl: string | null
  maxAttempts: number
  attributes: import('./game').Attribute[]
  status: RoomStatus
  mode: RoomMode
  players: RoomPlayerInfo[]
  hostSocketId: string
  currentTurnSocketId: string | null
  // Mode "classic" uniquement — feed partagé des tentatives complètes (qui
  // a deviné quel personnage). Vide en mode "hard", qui ne partage que les
  // champs corrects/proches (voir myBoard), jamais l'identité du personnage.
  attempts: FeedAttempt[]
  // Mode "hard" uniquement — plateau PARTAGÉ par tout le salon : un champ
  // correct/proche trouvé par n'importe quel joueur devient visible pour
  // tout le monde. Ce qui reste caché, c'est qui a deviné quel personnage
  // pour l'obtenir (voir myLastGuess) — pas la valeur du champ elle-même.
  myBoard?: Record<string, FieldFeedback>
  myLastGuess?: LastGuess | null
  myGuessedIds?: number[]
  winnerSocketId: string | null
  joinCode: string | null
  maxPlayers: number
}

export interface ChatMessage {
  id: number
  socketId: string
  username: string
  text: string
  timestamp: number
}
