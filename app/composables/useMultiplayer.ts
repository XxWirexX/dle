import { io, type Socket } from 'socket.io-client'
import type { RoomSnapshot, ChatMessage } from '#shared/types/multiplayer'

let socket: Socket | null = null

export function useMultiplayer() {
  const room = useState<RoomSnapshot | null>('mp-room', () => null)
  const inQueue = useState<boolean>('mp-in-queue', () => false)
  const error = useState<string | null>('mp-error', () => null)
  const messages = useState<ChatMessage[]>('mp-messages', () => [])
  const connected = useState<boolean>('mp-connected', () => false)

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

  function createRoom(slug: string, maxPlayers: number, difficulty: string | null = null) {
    connect()
    socket?.emit('mp:create-room', { slug, maxPlayers, difficulty })
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

  const mySocketId = computed(() => socket?.id ?? null)

  return {
    room,
    inQueue,
    error,
    messages,
    connected,
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
  }
}
