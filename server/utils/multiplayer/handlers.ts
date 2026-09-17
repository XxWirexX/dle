import type { Server, Socket } from 'socket.io'
import { roomManager } from './roomManager'
import { getCachedGamePlayData } from '../gameCache'
import type { AuthTokenPayload } from '#shared/types/user'

interface AuthedSocket extends Socket {
  data: { user: AuthTokenPayload | null }
}

export function registerMultiplayerHandlers(io: Server) {
  io.on('connection', (rawSocket) => {
    const socket = rawSocket as AuthedSocket
    const user = socket.data.user

    if (user) {
      roomManager.registerSocket(user.userId, socket.id)
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
      if (user) roomManager.unregisterSocket(user.userId)
      const result = roomManager.handleDisconnect(socket.id)
      if (result) io.to(result.room.id).emit('mp:room-update', roomManager.toSnapshot(result.room))
    })
  })
}
