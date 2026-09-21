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
  // Mode "classic" uniquement — feed partagé des tentatives de tout le
  // monde. Vide en mode "hard" (chaque joueur n'a que son propre plateau).
  attempts: FeedAttempt[]
  // Mode "hard" uniquement, propre à chaque destinataire du snapshot : les
  // champs correct/proche jamais obtenus par CE joueur restent gris,
  // jamais révélés — d'où le besoin d'un snapshot personnalisé par socket
  // plutôt qu'un seul broadcast partagé comme en mode classique.
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
