export function useFavorites() {
  const favoriteIds = useState<Set<number>>('favorite-game-ids', () => new Set())
  const { user } = useAuth()

  async function refresh() {
    if (!user.value) {
      favoriteIds.value = new Set()
      return
    }
    try {
      const data = await apiFetch<{ gameIds: number[] }>('/api/favorites')
      favoriteIds.value = new Set(data.gameIds)
    } catch {
      favoriteIds.value = new Set()
    }
  }

  function isFavorite(gameId: number) {
    return favoriteIds.value.has(gameId)
  }

  async function toggle(slug: string, gameId: number) {
    // Optimiste : l'API ne peut que confirmer ou renvoyer une erreur réseau,
    // pas de logique métier surprenante qui justifierait d'attendre la
    // réponse avant de mettre à jour l'étoile.
    const next = new Set(favoriteIds.value)
    const wasFavorite = next.has(gameId)
    if (wasFavorite) next.delete(gameId)
    else next.add(gameId)
    favoriteIds.value = next

    try {
      await $fetch(`/api/games/${slug}/favorite`, { method: 'POST' })
    } catch {
      // Rollback si la requête échoue réellement.
      const rollback = new Set(favoriteIds.value)
      if (wasFavorite) rollback.add(gameId)
      else rollback.delete(gameId)
      favoriteIds.value = rollback
    }
  }

  return { favoriteIds, isFavorite, toggle, refresh }
}
