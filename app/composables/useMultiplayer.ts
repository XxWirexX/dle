import { io, type Socket } from 'socket.io-client'
import type { RoomSnapshot, ChatMessage, RoomMode } from '#shared/types/multiplayer'

let socket: Socket | null = null

export interface FriendInvite {
  fromUsername: string
  slug: string
  gameName: string
  joinCode: string
}

export function useMultiplayer() {
  const room = useState<RoomSnapshot | null>('mp-room', () => null)
  const inQueue = useState<boolean>('mp-in-queue', () => false)
  const error = useState<string | null>('mp-error', () => null)
  const messages = useState<ChatMessage[]>('mp-messages', () => [])
  const connected = useState<boolean>('mp-connected', () => false)
  const onlineFriendIds = useState<number[]>('mp-online-friends', () => [])
  const pendingInvite = useState<FriendInvite | null>('mp-pending-invite', () => null)

  function connect() {
    if (socket?.connected) return

    socket = io({ transports: ['websocket', 'polling'] })

    socket.on('connect', () => { connected.value = true })
    socket.on('disconnect', () => { connected.value = false })

    socket.on('mp:queued', () => { inQueue.value = true; error.value = null })
    socket.on('mp:room-update', (snapshot: RoomSnapshot) => {
      inQueue.value = false
      room.value = snapshot
      if (snapshot.status === 'waiting' && messages.value.length === 0) messages.value = []
    })
    socket.on('mp:chat-message', (message: ChatMessage) => {
      messages.value.push(message)
    })
    socket.on('mp:error', ({ message }: { message: string }) => {
      error.value = message
      inQueue.value = false
    })
    socket.on('mp:left-room', () => {
      room.value = null
      messages.value = []
    })

    socket.on('friend:presence', ({ userId, online }: { userId: number; online: boolean }) => {
      onlineFriendIds.value = online
        ? [...new Set([...onlineFriendIds.value, userId])]
        : onlineFriendIds.value.filter((id) => id !== userId)
    })

    socket.on('friend:invite', (invite: FriendInvite) => {
      pendingInvite.value = invite
    })
  }

  function disconnect() {
    socket?.disconnect()
    socket = null
    connected.value = false
    room.value = null
    inQueue.value = false
    messages.value = []
  }

  function quickMatch(slug: string, difficulty: string | null = null) {
    connect()
    socket?.emit('mp:quick-match', { slug, difficulty })
  }

  function leaveQueue(slug: string) {
    socket?.emit('mp:leave-queue', { slug })
    inQueue.value = false
  }

  function createRoom(slug: string, maxPlayers: number, difficulty: string | null = null, mode: RoomMode = 'classic') {
    connect()
    socket?.emit('mp:create-room', { slug, maxPlayers, difficulty, mode })
  }

  function joinRoom(code: string) {
    connect()
    socket?.emit('mp:join-room', { code })
  }

  function startRoom() {
    socket?.emit('mp:start-room')
  }

  function guess(characterId: number) {
    socket?.emit('mp:guess', { characterId })
  }

  function rematch() {
    socket?.emit('mp:rematch')
  }

  function sendChat(text: string) {
    if (!text.trim()) return
    socket?.emit('mp:chat', { text: text.trim() })
  }

  function leaveRoom() {
    socket?.emit('mp:leave-room')
  }

  function inviteFriend(friendUserId: number, slug: string, maxPlayers = 8) {
    connect()
    socket?.emit('mp:invite-friend', { friendUserId, slug, maxPlayers })
  }

  function seedOnlineFriend(userId: number) {
    if (!onlineFriendIds.value.includes(userId)) onlineFriendIds.value = [...onlineFriendIds.value, userId]
  }

  function dismissInvite() {
    pendingInvite.value = null
  }

  function acceptInvite() {
    if (!pendingInvite.value) return
    joinRoom(pendingInvite.value.joinCode)
    const slug = pendingInvite.value.slug
    pendingInvite.value = null
    return slug
  }

  const mySocketId = computed(() => socket?.id ?? null)

  return {
    room,
    inQueue,
    error,
    messages,
    connected,
    onlineFriendIds,
    pendingInvite,
    mySocketId,
    connect,
    disconnect,
    quickMatch,
    leaveQueue,
    createRoom,
    joinRoom,
    startRoom,
    guess,
    rematch,
    sendChat,
    leaveRoom,
    inviteFriend,
    seedOnlineFriend,
    dismissInvite,
    acceptInvite,
  }
}
