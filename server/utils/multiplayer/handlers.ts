import type { Server, Socket } from 'socket.io'
import { roomManager } from './roomManager'
import { presence } from './presence'
import { getCachedGamePlayData } from '../gameCache'
import { listAcceptedFriends } from '../../db/queries/friends'
import { findGameIdBySlug, updateStats } from '../../db/queries/stats'
import type { AuthTokenPayload } from '#shared/types/user'
import type { RoomMode } from '#shared/types/multiplayer'

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
    // guessCounts plutôt qu'un filtre sur `room.attempts` : ce dernier
    // reste vide en mode "hard" (pas de feed partagé), donc ne reflète pas
    // le nombre réel de tentatives de chaque joueur dans ce mode.
    const playerAttempts = room.guessCounts.get(player.socketId) ?? 0
    const won = room.winnerSocketId === player.socketId
    await updateStats(player.userId, gameRow.id, { won, attempts: playerAttempts, isMultiplayer: true })
  }
}

// Prévient les amis invités qu'un salon n'est plus rejoignable — soit
// l'hôte est parti avant que quiconque ne rejoigne (le salon vient d'être
// supprimé), soit la partie a démarré sans eux.
function expireInvites(room: { joinCode: string | null; invitedUserIds: Set<number> }) {
  for (const userId of room.invitedUserIds) {
    presence.notifyUser(userId, 'friend:invite-expired', { joinCode: room.joinCode })
  }
}

// Chaque joueur reçoit son propre snapshot (nécessaire en mode "hard" pour
// ne jamais exposer le plateau ou la dernière tentative d'un autre joueur ;
// inoffensif en mode classique où le contenu est de toute façon identique
// pour tout le monde).
function broadcastRoom(io: Server, room: NonNullable<ReturnType<typeof roomManager.getRoom>> | null) {
  if (!room) return
  for (const player of room.players.values()) {
    io.to(player.socketId).emit('mp:room-update', roomManager.toSnapshot(room, player.socketId))
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

      // Republie les invitations encore valables : rien n'est persisté côté
      // client, donc un simple rechargement de page (ou la navigation vers
      // /notifications) les perdrait sinon.
      for (const invite of roomManager.getInvitesForUser(user.userId)) {
        socket.emit('friend:invite', invite)
      }
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
      broadcastRoom(io, room)
    })

    socket.on('mp:leave-queue', ({ slug }: { slug: string }) => {
      roomManager.leaveQuickMatch(socket.id, slug)
    })

    socket.on('mp:create-room', async ({ slug, maxPlayers, difficulty, mode }: { slug: string; maxPlayers: number; difficulty: string | null; mode?: RoomMode }) => {
      if (!user) return socket.emit('mp:error', { message: 'Connecte-toi pour jouer en multijoueur' })

      const gameData = await getCachedGamePlayData(slug)
      if (!gameData) return socket.emit('mp:error', { message: 'Jeu introuvable' })

      const room = roomManager.createPrivateRoom(
        { socketId: socket.id, userId: user.userId, username: user.username, difficulty: difficulty ?? null },
        slug,
        gameData,
        maxPlayers,
        difficulty ?? null,
        mode ?? 'classic',
      )
      socket.join(room.id)
      socket.emit('mp:room-update', roomManager.toSnapshot(room, socket.id))
    })

    socket.on('mp:join-room', ({ code }: { code: string }) => {
      if (!user) return socket.emit('mp:error', { message: 'Connecte-toi pour jouer en multijoueur' })

      const result = roomManager.joinPrivateRoom(
        { socketId: socket.id, userId: user.userId, username: user.username, difficulty: null },
        code,
      )
      if (!result.ok) return socket.emit('mp:error', { message: result.error })

      socket.join(result.room.id)
      broadcastRoom(io, result.room)
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
        socket.emit('mp:room-update', roomManager.toSnapshot(room, socket.id))
      }

      room.invitedUserIds.add(friendUserId)

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
      broadcastRoom(io, result.room)
      expireInvites(result.room)
    })

    socket.on('mp:guess', ({ characterId }: { characterId: number }) => {
      const room = roomManager.getRoom(socket.id)
      const result = roomManager.makeGuess(socket.id, characterId)
      if (!result.ok) return socket.emit('mp:error', { message: result.error })
      broadcastRoom(io, room)
      if (room && result.gameOver) recordMultiplayerStats(room).catch(() => {})
    })

    socket.on('mp:rematch', () => {
      const result = roomManager.requestRematch(socket.id)
      if ('error' in result) return socket.emit('mp:error', { message: result.error })
      broadcastRoom(io, result.room)
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
        if (result) {
          broadcastRoom(io, result.room)
          // Salon vidé par ce départ : plus personne à rejoindre, les
          // invitations en attente pour ce salon n'ont plus de sens.
          if (result.room.players.size === 0) expireInvites(result.room)
        }
      }
      socket.emit('mp:left-room', {})
    })

    socket.on('disconnect', () => {
      const result = roomManager.handleDisconnect(socket.id)
      if (result) {
        broadcastRoom(io, result.room)
        if (result.room.players.size === 0) expireInvites(result.room)
      }

      if (user) {
        const trulyOffline = presence.disconnect(user.userId, socket.id)
        if (trulyOffline) broadcastPresence(user.userId, false).catch(() => {})
      }
    })
  })
}
