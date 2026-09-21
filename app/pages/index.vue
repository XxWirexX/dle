<script setup lang="ts">
interface GlobalStats {
  totalPlayed: number
  winRate: number
  bestStreak: number
  favoriteGame: { gameSlug: string; gameName: string; gamesPlayed: number } | null
}

const { data: games } = await useFetch('/api/games', { key: 'games-list' })

const { user } = useAuth()
const { favoriteIds, refresh: refreshFavorites } = useFavorites()

const dailyStreaks = ref<Record<string, number>>({})
const globalStats = ref<GlobalStats | null>(null)
if (user.value) {
  await refreshFavorites()
  try {
    const stats = await apiFetch<{ global: GlobalStats; byGame: { gameSlug: string; dailyStreak: number }[] }>('/api/stats')
    dailyStreaks.value = Object.fromEntries(stats.byGame.map((g) => [g.gameSlug, g.dailyStreak]))
    globalStats.value = stats.global
  } catch {
    // Pas grave si ça échoue — la page reste utilisable sans les stats du hero.
  }
}

const favoriteGames = computed(() => games.value?.filter((g) => favoriteIds.value.has(g.id)) ?? [])
const otherGames = computed(() => games.value?.filter((g) => !favoriteIds.value.has(g.id)) ?? [])
</script>

<template>
  <div class="home">
    <section class="hero">
      <div class="hero-main">
        <h1 class="hero-title">
          <template v-if="user">Content de te revoir, {{ user.username }}</template>
          <template v-else>Devine le personnage</template>
        </h1>
        <p class="hero-subtitle">Choisis un anime et trouve le personnage mystère en un minimum d'essais.</p>

        <div v-if="globalStats && globalStats.totalPlayed > 0" class="hero-stats">
          <div class="hero-stat">
            <strong>{{ globalStats.totalPlayed }}</strong>
            <span>parties jouées</span>
          </div>
          <div class="hero-stat">
            <strong>{{ globalStats.winRate }}%</strong>
            <span>de victoires</span>
          </div>
          <div class="hero-stat">
            <strong>{{ globalStats.bestStreak }}</strong>
            <span>meilleure série</span>
          </div>
          <div v-if="globalStats.favoriteGame" class="hero-stat">
            <strong>{{ globalStats.favoriteGame.gameName }}</strong>
            <span>jeu favori</span>
          </div>
        </div>
        <NuxtLink v-else-if="!user" to="/register" class="hero-cta">Créer un compte →</NuxtLink>
      </div>

      <NuxtLink to="/random" class="hero-random">
        <span class="hero-random-icon">🎲</span>
        <span class="hero-random-title">Mode Random</span>
        <span class="hero-random-sub">Enchaîne plusieurs DLE différents à la suite</span>
        <span class="hero-random-cta">Jouer →</span>
      </NuxtLink>
    </section>

    <section v-if="favoriteGames.length > 0" class="section">
      <h2 class="section-title">★ Favoris</h2>
      <div class="grid">
        <GameCard v-for="game in favoriteGames" :key="game.slug" :game="game" :daily-streak="dailyStreaks[game.slug]" />
      </div>
    </section>

    <section class="section">
      <h2 class="section-title">{{ favoriteGames.length > 0 ? 'Tous les jeux' : 'Jeux disponibles' }}</h2>
      <div class="grid">
        <GameCard v-for="game in otherGames" :key="game.slug" :game="game" :daily-streak="dailyStreaks[game.slug]" />
      </div>
    </section>
  </div>
</template>

<style scoped>
.home {
  padding: 0 1.5rem 3rem;
  max-width: 1400px;
  margin: 0 auto;
}

.hero {
  display: grid;
  grid-template-columns: 1.4fr 1fr;
  gap: 1.25rem;
  margin-top: 1.75rem;
  padding: 2rem;
  background: radial-gradient(circle at 15% 20%, var(--accent-dim), transparent 55%), var(--bg-2);
  border: 1px solid var(--border);
  border-radius: 20px;
}

.hero-title {
  font-size: 1.9rem;
  font-weight: 800;
  color: var(--text);
  margin: 0 0 0.5rem;
  line-height: 1.15;
}

.hero-subtitle {
  color: var(--text-2);
  font-size: 0.95rem;
  margin: 0 0 1.25rem;
  max-width: 32rem;
}

.hero-stats {
  display: flex;
  flex-wrap: wrap;
  gap: 1.5rem;
}

.hero-stat {
  display: flex;
  flex-direction: column;
  gap: 0.1rem;
}

.hero-stat strong {
  font-size: 1.3rem;
  font-weight: 800;
  color: var(--text);
}

.hero-stat span {
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--text-3);
}

.hero-cta {
  display: inline-block;
  padding: 0.7rem 1.4rem;
  background: var(--accent);
  color: #fff;
  font-weight: 700;
  border-radius: 8px;
  transition: filter 0.15s;
}

.hero-cta:hover { filter: brightness(1.1); }

.hero-random {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.3rem;
  padding: 1.5rem;
  background: linear-gradient(135deg, rgba(139, 92, 246, 0.18), var(--accent-dim));
  border: 1px solid var(--border-2);
  border-radius: 16px;
  transition: border-color 0.15s, transform 0.15s;
}

.hero-random:hover {
  border-color: var(--accent);
  transform: translateY(-2px);
}

.hero-random-icon { font-size: 1.4rem; }
.hero-random-title { font-weight: 800; color: var(--text); font-size: 1.05rem; }
.hero-random-sub { color: var(--text-2); font-size: 0.82rem; }
.hero-random-cta { margin-top: 0.4rem; font-weight: 700; color: var(--accent-2); }

.section { margin-top: 0.5rem; }

.section-title {
  padding: 1.75rem 0 0.75rem;
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}

.grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(160px, 1fr));
  gap: 1rem;
}

@media (max-width: 768px) {
  .hero { grid-template-columns: 1fr; }
}

@media (max-width: 480px) {
  .home { padding: 0 1rem 2rem; }
  .hero { padding: 1.5rem; }
  .hero-title { font-size: 1.5rem; }
  .grid { grid-template-columns: repeat(2, 1fr); gap: 0.65rem; }
}
</style>
