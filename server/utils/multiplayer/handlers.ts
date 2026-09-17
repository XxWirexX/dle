import type { Server, Socket } from 'socket.io'
import { roomManager } from './roomManager'
import { presence } from './presence'
import { getCachedGamePlayData } from '../gameCache'
import { listAcceptedFriends } from '../../db/queries/friends'
import { findGameIdBySlug, updateStats } from '../../db/queries/stats'
import type { AuthTokenPayload } from '#shared/types/user'

interface AuthedSocket extends Socket {
  data: { user: AuthTokenPayload | null }
}

async function broadcastPresence(userId: number, online: boolean) {
  const friends = await listAcceptedFriends(userId)
  for (const friend of friends) {
    presence.notifyUser(friend.userId, 'friend:presence', { userId, online })
  }
}

// Le multi a déjà autorité totale côté serveur sur le résultat (voir
// makeGuess) : on enregistre donc les stats de tous les joueurs directement
// ici, sans passer par un endpoint HTTP côté client comme pour le solo/daily.
async function recordMultiplayerStats(room: NonNullable<ReturnType<typeof roomManager.getRoom>>) {
  const gameRow = await findGameIdBySlug(room.slug)
  if (!gameRow) return
  for (const player of room.players.values()) {
    const playerAttempts = room.attempts.filter((a) => a.socketId === player.socketId).length
    const won = room.winnerSocketId === player.socketId
    await updateStats(player.userId, gameRow.id, { won, attempts: playerAttempts, isMultiplayer: true })
  }
}

export function registerMultiplayerHandlers(io: Server) {
  presence.bind(io)

  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket
    const user = socket.data.user

    if (user) {
      const wasOffline = !presence.isOnline(user.userId)
      presence.connect(user.userId, socket.id)
      if (wasOffline) broadcastPresence(user.userId, true).catch(() => {})
    }

    socket.on('mp:quick-match', async ({ slug, difficulty }: { slug: string; difficulty: string | null }) => {
      if (!user) return socket.emit('mp:error', { message: 'Connecte-toi pour jouer en multijoueur' })

      const gameData = await getCachedGamePlayData(slug)
      if (!gameData) return socket.emit('mp:error', { message: 'Jeu introuvable' })

      const result = roomManager.joinQuickMatch(
        { socketId: socket.id, userId: user.userId, username: user.username, difficulty: difficulty ?? null },
        slug,
        gameData,
      )

      if (result.status === 'queued') {
        socket.emit('mp:queued', {})
        return
      }

      const room = result.room
      for (const p of room.players.values()) {
        io.sockets.sockets.get(p.socketId)?.join(room.id)
      }
      io.to(room.id).emit('mp:room-update', roomManager.toSnapshot(room))
    })

    socket.on('mp:leave-queue', ({ slug }: { slug: string }) => {
      roomManager.leaveQuickMatch(socket.id, slug)
    })

    socket.on('mp:create-room', async ({ slug, maxPlayers, difficulty }: { slug: string; maxPlayers: number; difficulty: string | null }) => {
      if (!user) return socket.emit('mp:error', { message: 'Connecte-toi pour jouer en multijoueur' })

      const gameData = await getCachedGamePlayData(slug)
      if (!gameData) return socket.emit('mp:error', { message: 'Jeu introuvable' })

      const room = roomManager.createPrivateRoom(
        { socketId: socket.id, userId: user.userId, username: user.username, difficulty: difficulty ?? null },
        slug,
        gameData,
        maxPlayers,
        difficulty ?? null,
      )
      socket.join(room.id)
      socket.emit('mp:room-update', roomManager.toSnapshot(room))
    })

    socket.on('mp:join-room', ({ code }: { code: string }) => {
      if (!user) return socket.emit('mp:error', { message: 'Connecte-toi pour jouer en multijoueur' })

      const result = roomManager.joinPrivateRoom(
        { socketId: socket.id, userId: user.userId, username: user.username, difficulty: null },
        code,
      )
      if (!result.ok) return socket.emit('mp:error', { message: result.error })

      socket.join(result.room.id)
      io.to(result.room.id).emit('mp:room-update', roomManager.toSnapshot(result.room))
    })

    // Invitation directe depuis la liste d'amis : crée (ou réutilise) un
    // salon privé et pousse un événement à l'ami s'il est en ligne — pas
    // de file d'attente persistante pour un ami hors-ligne, ça n'a jamais
    // été demandé et ça ajouterait un système à maintenir pour rien.
    socket.on('mp:invite-friend', async ({ friendUserId, slug, maxPlayers }: { friendUserId: number; slug: string; maxPlayers: number }) => {
      if (!user) return socket.emit('mp:error', { message: 'Connecte-toi pour jouer en multijoueur' })
      if (!presence.isOnline(friendUserId)) return socket.emit('mp:error', { message: "Cet ami n'est pas en ligne" })

      let room = roomManager.getRoom(socket.id)
      if (!room || room.status !== 'waiting') {
        const gameData = await getCachedGamePlayData(slug)
        if (!gameData) return socket.emit('mp:error', { message: 'Jeu introuvable' })
        room = roomManager.createPrivateRoom(
          { socketId: socket.id, userId: user.userId, username: user.username, difficulty: null },
          slug,
          gameData,
          maxPlayers,
          null,
        )
        socket.join(room.id)
        socket.emit('mp:room-update', roomManager.toSnapshot(room))
      }

      presence.notifyUser(friendUserId, 'friend:invite', {
        fromUsername: user.username,
        slug,
        gameName: room.gameData.name,
        joinCode: room.joinCode,
      })
      socket.emit('mp:invite-sent', {})
    })

    socket.on('mp:start-room', () => {
      const result = roomManager.startRoomByHost(socket.id)
      if (!result.ok) return socket.emit('mp:error', { message: result.error })
      io.to(result.room.id).emit('mp:room-update', roomManager.toSnapshot(result.room))
    })

    socket.on('mp:guess', ({ characterId }: { characterId: number }) => {
      const room = roomManager.getRoom(socket.id)
      const result = roomManager.makeGuess(socket.id, characterId)
      if (!result.ok) return socket.emit('mp:error', { message: result.error })
      if (room) io.to(room.id).emit('mp:room-update', roomManager.toSnapshot(room))
      if (room && result.gameOver) recordMultiplayerStats(room).catch(() => {})
    })

    socket.on('mp:rematch', () => {
      const result = roomManager.requestRematch(socket.id)
      if ('error' in result) return socket.emit('mp:error', { message: result.error })
      io.to(result.room.id).emit('mp:room-update', roomManager.toSnapshot(result.room))
    })

    socket.on('mp:chat', ({ text }: { text: string }) => {
      if (!text || typeof text !== 'string') return
      const result = roomManager.addChatMessage(socket.id, text)
      if (result) io.to(result.room.id).emit('mp:chat-message', result.message)
    })

    socket.on('mp:leave-room', () => {
      const roomId = roomManager.getRoomIdForSocket(socket.id)
      const result = roomManager.leaveRoom(socket.id)
      if (roomId) {
        socket.leave(roomId)
        if (result) io.to(roomId).emit('mp:room-update', roomManager.toSnapshot(result.room))
      }
      socket.emit('mp:left-room', {})
    })

    socket.on('disconnect', () => {
      const result = roomManager.handleDisconnect(socket.id)
      if (result) io.to(result.room.id).emit('mp:room-update', roomManager.toSnapshot(result.room))

      if (user) {
        const trulyOffline = presence.disconnect(user.userId, socket.id)
        if (trulyOffline) broadcastPresence(user.userId, false).catch(() => {})
      }
    })
  })
}
