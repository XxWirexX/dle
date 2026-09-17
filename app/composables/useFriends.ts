export interface Friend {
  friendshipId: number
  userId: number
  username: string
  avatarColor: string
  avatarImageUrl: string | null
  online: boolean
}

export interface FriendRequest {
  friendshipId: number
  userId: number
  username: string
  avatarColor: string
  createdAt: string
}

export function useFriends() {
  const friends = useState<Friend[]>('friends-list', () => [])
  const incoming = useState<FriendRequest[]>('friends-incoming', () => [])
  const outgoing = useState<FriendRequest[]>('friends-outgoing', () => [])
  const loading = ref(false)

  const { onlineFriendIds, seedOnlineFriend } = useMultiplayer()

  async function refresh() {
    loading.value = true
    try {
      const data = await apiFetch('/api/friends')
      friends.value = data.friends
      incoming.value = data.incoming
      outgoing.value = data.outgoing
      for (const f of data.friends) if (f.online) seedOnlineFriend(f.userId)
    } finally {
      loading.value = false
    }
  }

  // La présence vit dans useMultiplayer (même socket) ; on la fusionne
  // ici pour que la liste d'amis reste à jour sans repasser par l'API.
  const friendsWithLivePresence = computed(() =>
    friends.value.map((f) => ({ ...f, online: f.online || onlineFriendIds.value.includes(f.userId) })),
  )

  async function sendRequest(username: string) {
    await apiFetch('/api/friends/request', { method: 'POST', body: { username } })
    await refresh()
  }

  async function respond(friendshipId: number, accept: boolean) {
    await apiFetch(`/api/friends/${friendshipId}/respond`, { method: 'POST', body: { accept } })
    await refresh()
  }

  async function remove(friendshipId: number) {
    await apiFetch(`/api/friends/${friendshipId}`, { method: 'DELETE' })
    await refresh()
  }

  return { friends: friendsWithLivePresence, incoming, outgoing, loading, refresh, sendRequest, respond, remove }
}
