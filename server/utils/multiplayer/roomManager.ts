import { nanoid, customAlphabet } from 'nanoid'
import { computeGuessFeedback } from '#shared/utils/feedback'
import type { GamePlayData, Character, FieldFeedback } from '#shared/types/game'
import type { RoomSnapshot, RoomPlayerInfo, FeedAttempt, ChatMessage, RoomMode, LastGuess } from '#shared/types/multiplayer'

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
  mode: RoomMode
  // Mode "hard" uniquement : le plateau propre à chaque joueur (champs
  // correct/proche déjà débloqués, jamais les faux) et sa dernière
  // tentative isolée (remplacée, jamais accumulée, à chaque nouveau guess).
  hardBoards: Map<string, Record<string, FieldFeedback>>
  hardLastGuess: Map<string, LastGuess | null>
  // Exclusion propre à chaque joueur en mode "hard" — contrairement au mode
  // classique, un personnage tenté par quelqu'un d'autre ne doit pas
  // disparaître sans explication de la recherche des autres joueurs.
  hardGuessedIds: Map<string, Set<number>>
  // Nombre de tentatives par joueur, quel que soit le mode — en mode
  // "hard" `attempts` reste vide, donc les stats ont besoin d'un compteur
  // dédié plutôt que de déduire un décompte depuis le feed partagé.
  guessCounts: Map<string, number>
}

export type GuessResult =
  | { ok: true; feedback: ReturnType<typeof computeGuessFeedback>; isCorrect: boolean; gameOver: boolean }
  | { ok: false; error: string }

export class RoomManager {
  private rooms = new Map<string, Room>()
  private playerRoom = new Map<string, string>()
  private queues = new Map<string, QueueEntry[]>()

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
  createPrivateRoom(entry: QueueEntry, slug: string, gameData: GamePlayData, maxPlayers: number, difficulty: string | null, mode: RoomMode = 'classic'): Room {
    return this.createRoom({ slug, gameData, hostEntry: entry, maxPlayers, isPrivate: true, difficulty, mode })
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
    mode?: RoomMode
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
      mode: opts.mode ?? 'classic',
      hardBoards: new Map(),
      hardLastGuess: new Map(),
      hardGuessedIds: new Map(),
      guessCounts: new Map(),
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
    room.hardBoards = new Map()
    room.hardLastGuess = new Map()
    room.hardGuessedIds = new Map()
    room.guessCounts = new Map()
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

    const alreadyGuessed = room.mode === 'hard'
      ? (room.hardGuessedIds.get(socketId)?.has(characterId) ?? false)
      : room.guessedCharacterIds.has(characterId)
    if (alreadyGuessed) return { ok: false, error: 'Ce personnage a déjà été joué' }

    // Résolu depuis les données du jeu connues du serveur — jamais depuis
    // ce que le client prétend avoir deviné (c'était la faille de la v1 :
    // le serveur faisait confiance à l'objet personnage envoyé par le
    // client pour calculer le feedback).
    const guess = room.gameData.characters.find((c) => c.id === characterId)
    if (!guess) return { ok: false, error: 'Personnage inconnu' }
    const target = room.gameData.characters.find((c) => c.id === room.targetId)!

    const feedback = computeGuessFeedback(guess, target, room.gameData.attributes)
    const isCorrect = guess.id === target.id

    const player = room.players.get(socketId)!
    room.guessCounts.set(socketId, (room.guessCounts.get(socketId) ?? 0) + 1)

    if (room.mode === 'hard') {
      const guessed = room.hardGuessedIds.get(socketId) ?? new Set<number>()
      guessed.add(characterId)
      room.hardGuessedIds.set(socketId, guessed)
      // Le plateau ne s'enrichit que des champs correct/proche — les faux
      // ne laissent jamais de trace, et la dernière tentative remplace la
      // précédente au lieu de s'accumuler dans un historique visible.
      const board = room.hardBoards.get(socketId) ?? {}
      for (const [key, fieldFeedback] of Object.entries(feedback)) {
        if (fieldFeedback.type === 'correct' || fieldFeedback.type === 'close') board[key] = fieldFeedback
      }
      room.hardBoards.set(socketId, board)
      room.hardLastGuess.set(socketId, { character: guess, feedback, isCorrect })
    } else {
      room.guessedCharacterIds.add(characterId)
      room.attempts.push({ socketId, username: player.username, character: guess, feedback, isCorrect })
    }

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
    // Capturé avant de retirer qui que ce soit du tableau : retirer un
    // joueur AVANT le tour en cours décale les index de tout le monde, donc
    // réutiliser l'ancien currentTurnIndex tel quel peut pointer sur un
    // joueur différent, ou sortir des bornes et déclencher un reset
    // arbitraire à l'index 0 alors que ce n'était même pas son tour.
    const currentSocketId = room.status === 'playing' ? this.currentTurnSocketId(room) : null

    room.players.delete(socketId)
    this.playerRoom.delete(socketId)
    room.turnOrder = room.turnOrder.filter((id) => id !== socketId)

    if (room.players.size === 0) {
      this.rooms.delete(room.id)
    } else if (wasHost) {
      room.hostSocketId = room.turnOrder[0] ?? [...room.players.keys()][0]!
    }

    if (room.status === 'playing' && room.turnOrder.length > 0) {
      if (currentSocketId && currentSocketId !== socketId) {
        // Ce n'était pas le tour du joueur qui part : on retrouve la
        // position du vrai joueur courant dans le tableau qui vient de se
        // décaler, plutôt que de deviner à partir de l'ancien index.
        const newIndex = room.turnOrder.indexOf(currentSocketId)
        room.currentTurnIndex = newIndex !== -1 ? newIndex : 0
      } else {
        // C'était son tour (ou aucun tour valide n'existait) : l'ancien
        // index pointe maintenant naturellement sur le joueur suivant,
        // puisque tout ce qui suivait a glissé d'un cran.
        room.currentTurnIndex = room.currentTurnIndex % room.turnOrder.length
        if (!room.players.get(room.turnOrder[room.currentTurnIndex]!)?.connected) {
          this.advanceTurn(room)
        }
      }
    }

    return { room, wasHost }
  }

  handleDisconnect(socketId: string): { room: Room } | null {
    this.leaveAllQueues(socketId)
    const room = this.getRoom(socketId)
    if (!room) return null

    // En salle d'attente, un fantôme déconnecté ne fait que bloquer un
    // siège (et l'hôte si c'est lui) sans qu'aucun état de partie ne
    // justifie de le garder — on le retire complètement, comme un vrai
    // départ, plutôt que de le laisser bloquer indéfiniment le salon.
    if (room.status === 'waiting') {
      const result = this.leaveRoom(socketId)
      return result ? { room: result.room } : null
    }

    const player = room.players.get(socketId)
    if (player) player.connected = false

    if (room.status === 'playing' && this.currentTurnSocketId(room) === socketId) {
      this.advanceTurn(room)
    }

    return { room }
  }

  // `forSocketId` : obligatoire en mode "hard" pour renvoyer le plateau et
  // la dernière tentative propres à CE joueur — jamais ceux d'un autre,
  // c'est tout le principe du mode. Ignoré en mode classique (partagé).
  toSnapshot(room: Room, forSocketId?: string): RoomSnapshot {
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
      mode: room.mode,
      players,
      hostSocketId: room.hostSocketId,
      currentTurnSocketId: this.currentTurnSocketId(room),
      attempts: room.mode === 'classic' ? room.attempts : [],
      myBoard: room.mode === 'hard' && forSocketId ? (room.hardBoards.get(forSocketId) ?? {}) : undefined,
      myLastGuess: room.mode === 'hard' && forSocketId ? (room.hardLastGuess.get(forSocketId) ?? null) : undefined,
      myGuessedIds: room.mode === 'hard' && forSocketId ? [...(room.hardGuessedIds.get(forSocketId) ?? [])] : undefined,
      winnerSocketId: room.winnerSocketId,
      joinCode: room.joinCode,
      maxPlayers: room.maxPlayers,
    }
  }
}

export const roomManager = new RoomManager()
