import type { Character, GuessFeedback } from './game'

export type RoomStatus = 'waiting' | 'playing' | 'finished'

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

export interface RoomSnapshot {
  id: string
  slug: string
  gameName: string
  backgroundUrl: string | null
  maxAttempts: number
  attributes: import('./game').Attribute[]
  status: RoomStatus
  players: RoomPlayerInfo[]
  hostSocketId: string
  currentTurnSocketId: string | null
  attempts: FeedAttempt[]
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
