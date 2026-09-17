import { nanoid, customAlphabet } from 'nanoid'
import { computeGuessFeedback } from '#shared/utils/feedback'
import type { GamePlayData, Character } from '#shared/types/game'
import type { RoomSnapshot, RoomPlayerInfo, FeedAttempt, ChatMessage } from '#shared/types/multiplayer'

const joinCode = customAlphabet('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 6) // sans caractères ambigus

const DIFFICULTY_LEVELS: Record<string, number> = { facile: 1, moyen: 2, difficile: 3 }
function difficultyLevel(value: unknown): number {
  return DIFFICULTY_LEVELS[String(value).toLowerCase()] ?? 0
}

interface Player {
  socketId: string
  userId: number
  username: string
  score: number
  connected: boolean
}

interface QueueEntry {
  socketId: string
  userId: number
  username: string
  difficulty: string | null
}

interface Room {
  id: string
  slug: string
  gameData: GamePlayData
  pool: Character[] // personnages jouables dans cette room (filtrés par difficulté)
  maxPlayers: number
  isPrivate: boolean
  joinCode: string | null
  hostSocketId: string
  players: Map<string, Player>
  turnOrder: string[]
  currentTurnIndex: number
  targetId: number | null
  guessedCharacterIds: Set<number>
  attempts: FeedAttempt[]
  messages: ChatMessage[]
  status: 'waiting' | 'playing' | 'finished'
  winnerSocketId: string | null
}

export type GuessResult =
  | { ok: true; feedback: ReturnType<typeof computeGuessFeedback>; isCorrect: boolean; gameOver: boolean }
  | { ok: false; error: string }

export class RoomManager {
  private rooms = new Map<string, Room>()
  private playerRoom = new Map<string, string>()
  private queues = new Map<string, QueueEntry[]>()
  private userSockets = new Map<number, string>()

  // ─── Présence / registre utilisateur ─────────────────────────────
  registerSocket(userId: number, socketId: string) {
    this.userSockets.set(userId, socketId)
  }

  unregisterSocket(userId: number) {
    this.userSockets.delete(userId)
  }

  socketIdForUser(userId: number): string | undefined {
    return this.userSockets.get(userId)
  }

  getRoomIdForSocket(socketId: string): string | undefined {
    return this.playerRoom.get(socketId)
  }

  // ─── Matchmaking rapide (1v1) ─────────────────────────────────────
  joinQuickMatch(entry: QueueEntry, slug: string, gameData: GamePlayData): { status: 'queued' } | { status: 'matched'; room: Room } {
    const queue = this.queues.get(slug) ?? []
    this.queues.set(slug, queue)

    if (queue.some((q) => q.socketId === entry.socketId)) {
      return { status: 'queued' }
    }

    queue.push(entry)

    if (queue.length >= 2) {
      const [p1, p2] = queue.splice(0, 2) as [QueueEntry, QueueEntry]
      const room = this.createRoom({
        slug,
        gameData,
        hostEntry: p1,
        maxPlayers: 2,
        isPrivate: false,
        difficulty: this.mostRestrictiveDifficulty(p1.difficulty, p2.difficulty),
      })
      this.addPlayerToRoom(room, p2)
      this.startRoom(room)
      return { status: 'matched', room }
    }

    return { status: 'queued' }
  }

  leaveQuickMatch(socketId: string, slug: string) {
    const queue = this.queues.get(slug)
    if (!queue) return
    const idx = queue.findIndex((q) => q.socketId === socketId)
    if (idx !== -1) queue.splice(idx, 1)
  }

  leaveAllQueues(socketId: string) {
    for (const queue of this.queues.values()) {
      const idx = queue.findIndex((q) => q.socketId === socketId)
      if (idx !== -1) queue.splice(idx, 1)
    }
  }

  private mostRestrictiveDifficulty(a: string | null, b: string | null): string | null {
    const levelA = a ? difficultyLevel(a) : 0
    const levelB = b ? difficultyLevel(b) : 0
    const max = Math.max(levelA, levelB)
    if (max === 0) return null
    return Object.keys(DIFFICULTY_LEVELS).find((k) => DIFFICULTY_LEVELS[k] === max) ?? null
  }

  // ─── Salons privés (2 à N joueurs) ────────────────────────────────
  createPrivateRoom(entry: QueueEntry, slug: string, gameData: GamePlayData, maxPlayers: number, difficulty: string | null): Room {
    return this.createRoom({ slug, gameData, hostEntry: entry, maxPlayers, isPrivate: true, difficulty })
  }

  joinPrivateRoom(entry: QueueEntry, code: string): { ok: true; room: Room } | { ok: false; error: string } {
    const room = [...this.rooms.values()].find((r) => r.joinCode === code.toUpperCase())
    if (!room) return { ok: false, error: 'Salon introuvable' }
    if (room.status !== 'waiting') return { ok: false, error: 'La partie a déjà commencé' }
    if (room.players.size >= room.maxPlayers) return { ok: false, error: 'Salon complet' }

    this.addPlayerToRoom(room, entry)
    return { ok: true, room }
  }

  startRoomByHost(socketId: string): { ok: true; room: Room } | { ok: false; error: string } {
    const room = this.getRoom(socketId)
    if (!room) return { ok: false, error: 'Salon introuvable' }
    if (room.hostSocketId !== socketId) return { ok: false, error: 'Seul l\'hôte peut démarrer la partie' }
    if (room.status !== 'waiting') return { ok: false, error: 'La partie a déjà commencé' }
    if (room.players.size < 2) return { ok: false, error: 'Il faut au moins 2 joueurs' }

    this.startRoom(room)
    return { ok: true, room }
  }

  private createRoom(opts: {
    slug: string
    gameData: GamePlayData
    hostEntry: QueueEntry
    maxPlayers: number
    isPrivate: boolean
    difficulty: string | null
  }): Room {
    const pool = opts.difficulty
      ? opts.gameData.characters.filter((c) => difficultyLevel(c.attributes.difficulty) <= difficultyLevel(opts.difficulty))
      : opts.gameData.characters

    const room: Room = {
      id: nanoid(10),
      slug: opts.slug,
      gameData: opts.gameData,
      pool: pool.length > 0 ? pool : opts.gameData.characters,
      maxPlayers: Math.max(2, Math.min(opts.maxPlayers, 8)),
      isPrivate: opts.isPrivate,
      joinCode: opts.isPrivate ? joinCode() : null,
      hostSocketId: opts.hostEntry.socketId,
      players: new Map(),
      turnOrder: [],
      currentTurnIndex: 0,
      targetId: null,
      guessedCharacterIds: new Set(),
      attempts: [],
      messages: [],
      status: 'waiting',
      winnerSocketId: null,
    }

    this.addPlayerToRoom(room, opts.hostEntry)
    this.rooms.set(room.id, room)
    return room
  }

  private addPlayerToRoom(room: Room, entry: QueueEntry) {
    room.players.set(entry.socketId, {
      socketId: entry.socketId,
      userId: entry.userId,
      username: entry.username,
      score: 0,
      connected: true,
    })
    this.playerRoom.set(entry.socketId, room.id)
  }

  private startRoom(room: Room) {
    room.status = 'playing'
    room.turnOrder = [...room.players.keys()].sort(() => Math.random() - 0.5)
    room.currentTurnIndex = 0
    room.targetId = room.pool[Math.floor(Math.random() * room.pool.length)]!.id
    room.guessedCharacterIds = new Set()
    room.attempts = []
    room.winnerSocketId = null
  }

  getRoom(socketId: string): Room | null {
    const roomId = this.playerRoom.get(socketId)
    if (!roomId) return null
    return this.rooms.get(roomId) ?? null
  }

  currentTurnSocketId(room: Room): string | null {
    if (room.status !== 'playing' || room.turnOrder.length === 0) return null
    return room.turnOrder[room.currentTurnIndex] ?? null
  }

  private advanceTurn(room: Room) {
    if (room.turnOrder.length === 0) return
    for (let i = 0; i < room.turnOrder.length; i++) {
      room.currentTurnIndex = (room.currentTurnIndex + 1) % room.turnOrder.length
      const nextSocketId = room.turnOrder[room.currentTurnIndex]!
      if (room.players.get(nextSocketId)?.connected) return
    }
  }

  makeGuess(socketId: string, characterId: number): GuessResult {
    const room = this.getRoom(socketId)
    if (!room) return { ok: false, error: 'Salon introuvable' }
    if (room.status !== 'playing') return { ok: false, error: 'La partie n\'est pas en cours' }
    if (this.currentTurnSocketId(room) !== socketId) return { ok: false, error: "Ce n'est pas ton tour" }
    if (room.guessedCharacterIds.has(characterId)) return { ok: false, error: 'Ce personnage a déjà été joué' }

    // Résolu depuis les données du jeu connues du serveur — jamais depuis
    // ce que le client prétend avoir deviné (c'était la faille de la v1 :
    // le serveur faisait confiance à l'objet personnage envoyé par le
    // client pour calculer le feedback).
    const guess = room.gameData.characters.find((c) => c.id === characterId)
    if (!guess) return { ok: false, error: 'Personnage inconnu' }
    const target = room.gameData.characters.find((c) => c.id === room.targetId)!

    const feedback = computeGuessFeedback(guess, target, room.gameData.attributes)
    const isCorrect = guess.id === target.id

    room.guessedCharacterIds.add(characterId)
    const player = room.players.get(socketId)!
    room.attempts.push({ socketId, username: player.username, character: guess, feedback, isCorrect })

    let gameOver = false
    if (isCorrect) {
      room.status = 'finished'
      room.winnerSocketId = socketId
      player.score++
      gameOver = true
    } else {
      this.advanceTurn(room)
    }

    return { ok: true, feedback, isCorrect, gameOver }
  }

  requestRematch(socketId: string): { allReady: boolean; room: Room } | { error: string } {
    const room = this.getRoom(socketId)
    if (!room) return { error: 'Salon introuvable' }
    if (room.status !== 'finished') return { error: "La partie n'est pas terminée" }
    if (room.hostSocketId !== socketId) return { error: "Seul l'hôte peut relancer la partie" }

    this.startRoom(room)
    return { allReady: true, room }
  }

  addChatMessage(socketId: string, text: string): { room: Room; message: ChatMessage } | null {
    const room = this.getRoom(socketId)
    if (!room) return null
    const player = room.players.get(socketId)
    if (!player) return null

    const message: ChatMessage = {
      id: Date.now(),
      socketId,
      username: player.username,
      text: text.slice(0, 200),
      timestamp: Date.now(),
    }
    room.messages.push(message)
    if (room.messages.length > 50) room.messages.shift()
    return { room, message }
  }

  leaveRoom(socketId: string): { room: Room; wasHost: boolean } | null {
    const room = this.getRoom(socketId)
    if (!room) return null

    const wasHost = room.hostSocketId === socketId
    room.players.delete(socketId)
    this.playerRoom.delete(socketId)
    room.turnOrder = room.turnOrder.filter((id) => id !== socketId)

    if (room.players.size === 0) {
      this.rooms.delete(room.id)
    } else if (wasHost) {
      room.hostSocketId = room.turnOrder[0] ?? [...room.players.keys()][0]!
    }

    if (room.status === 'playing' && this.currentTurnSocketId(room) === null && room.turnOrder.length > 0) {
      room.currentTurnIndex = 0
    }

    return { room, wasHost }
  }

  handleDisconnect(socketId: string): { room: Room } | null {
    this.leaveAllQueues(socketId)
    const room = this.getRoom(socketId)
    if (!room) return null

    const player = room.players.get(socketId)
    if (player) player.connected = false

    if (room.status === 'playing' && this.currentTurnSocketId(room) === socketId) {
      this.advanceTurn(room)
    }

    return { room }
  }

  toSnapshot(room: Room): RoomSnapshot {
    const players: RoomPlayerInfo[] = [...room.players.values()].map((p) => ({
      socketId: p.socketId,
      userId: p.userId,
      username: p.username,
      score: p.score,
      connected: p.connected,
    }))

    return {
      id: room.id,
      slug: room.slug,
      gameName: room.gameData.name,
      backgroundUrl: room.gameData.backgroundUrl,
      maxAttempts: room.gameData.maxAttempts,
      attributes: room.gameData.attributes,
      status: room.status,
      players,
      hostSocketId: room.hostSocketId,
      currentTurnSocketId: this.currentTurnSocketId(room),
      attempts: room.attempts,
      winnerSocketId: room.winnerSocketId,
      joinCode: room.joinCode,
      maxPlayers: room.maxPlayers,
    }
  }
}

export const roomManager = new RoomManager()
