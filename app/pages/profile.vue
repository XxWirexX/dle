<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user } = useAuth()
const { data: stats, pending, error } = await useFetch('/api/stats', { key: 'my-stats' })

const { data: myGames, refresh: refreshMyGames } = await useFetch('/api/games/mine', { key: 'my-games' })
const deletingSlug = ref<string | null>(null)

async function onDeleteGame(slug: string) {
  if (!confirm('Supprimer ce DLE ? Cette action est irréversible.')) return
  deletingSlug.value = slug
  try {
    await $fetch(`/api/games/${slug}`, { method: 'DELETE' })
    await refreshMyGames()
  } finally {
    deletingSlug.value = null
  }
}
</script>

<template>
  <div class="profile-page">
    <div v-if="user" class="profile-header">
      <span class="avatar" :style="{ background: user.avatarColor }">
        <img v-if="user.avatarImageUrl" :src="cloudinaryUrl(user.avatarImageUrl, 128)" :alt="user.username">
        <span v-else>{{ user.username[0]?.toUpperCase() }}</span>
      </span>
      <div>
        <h1 class="username">{{ user.username }}</h1>
        <p class="email">{{ user.email }}</p>
      </div>
    </div>

    <p v-if="pending" class="muted">Chargement des statistiques...</p>
    <p v-else-if="error" class="banner banner-error">Impossible de charger les statistiques.</p>

    <template v-else-if="stats">
      <section class="global-stats">
        <div class="stat-card">
          <div class="stat-value">{{ stats.global.totalPlayed }}</div>
          <div class="stat-label">Parties jouées</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.global.winRate }}%</div>
          <div class="stat-label">Taux de victoire</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.global.avgAttempts }}</div>
          <div class="stat-label">Essais en moyenne</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">{{ stats.global.bestStreak }}</div>
          <div class="stat-label">Meilleure série</div>
        </div>
      </section>

      <NuxtLink
        v-if="stats.global.favoriteGame"
        :to="`/games/${stats.global.favoriteGame.gameSlug}`"
        class="favorite-game"
      >
        <span class="favorite-label">⭐ Jeu favori</span>
        <span class="favorite-name">{{ stats.global.favoriteGame.gameName }}</span>
        <span class="favorite-count">{{ stats.global.favoriteGame.gamesPlayed }} partie{{ stats.global.favoriteGame.gamesPlayed > 1 ? 's' : '' }}</span>
      </NuxtLink>

      <section class="detail-stats">
        <div class="detail-card">
          <div class="detail-title">Solo</div>
          <div class="detail-row"><span>Parties</span><span>{{ stats.global.soloPlayed }}</span></div>
          <div class="detail-row"><span>Victoires</span><span>{{ stats.global.soloWins }}</span></div>
          <div class="detail-row"><span>Taux de victoire</span><span>{{ stats.global.soloWinRate }}%</span></div>
        </div>
        <div class="detail-card">
          <div class="detail-title">Multijoueur</div>
          <div class="detail-row"><span>Parties</span><span>{{ stats.global.multiplayerPlayed }}</span></div>
          <div class="detail-row"><span>Victoires</span><span>{{ stats.global.multiplayerWins }}</span></div>
          <div class="detail-row"><span>Taux de victoire</span><span>{{ stats.global.multiplayerWinRate }}%</span></div>
        </div>
      </section>

      <section class="by-game">
        <h2 class="section-title">Par jeu</h2>
        <p v-if="stats.byGame.length === 0" class="muted">Aucune partie jouée pour l'instant.</p>
        <ul v-else class="game-list">
          <li v-for="g in stats.byGame" :key="g.gameId" class="game-row">
            <NuxtLink :to="`/games/${g.gameSlug}`" class="game-name">{{ g.gameName }}</NuxtLink>
            <div class="game-metrics">
              <span class="metric">{{ g.gamesPlayed }} partie{{ g.gamesPlayed > 1 ? 's' : '' }}</span>
              <span class="metric">{{ g.winRate }}% de victoires</span>
              <span class="metric">{{ g.avgAttempts }} essais en moyenne</span>
              <span class="metric" v-if="g.bestAttempts !== null">
                Record : {{ g.bestAttempts }} essai{{ g.bestAttempts > 1 ? 's' : '' }}
              </span>
              <span class="metric">Série {{ g.currentStreak }} (max {{ g.maxStreak }})</span>
              <span class="metric daily" v-if="g.dailyPlayed > 0">
                Quotidien : {{ g.dailyWins }}/{{ g.dailyPlayed }} · série {{ g.dailyStreak }} (max {{ g.dailyMaxStreak }})
              </span>
              <span class="metric" v-if="g.multiplayerPlayed > 0">
                Multi : {{ g.multiplayerWins }}/{{ g.multiplayerPlayed }}
              </span>
            </div>
          </li>
        </ul>
      </section>
    </template>

    <section class="my-games">
      <div class="my-games-header">
        <h2 class="section-title">Mes créations</h2>
        <NuxtLink to="/games/create" class="btn btn-sm btn-primary">+ Créer un DLE</NuxtLink>
      </div>
      <p v-if="!myGames || myGames.length === 0" class="muted">Tu n'as encore créé aucun DLE custom.</p>
      <ul v-else class="game-list">
        <li v-for="g in myGames" :key="g.slug" class="game-row my-game-row">
          <NuxtLink :to="`/games/${g.slug}`" class="game-name">
            {{ g.name }}
            <span class="visibility-badge" :class="g.visibility">{{ g.visibility === 'public' ? 'Public' : 'Privé' }}</span>
          </NuxtLink>
          <div class="game-metrics">
            <span class="metric">{{ g.characterCount }} personnages · {{ g.attributeCount }} attributs</span>
          </div>
          <button class="btn btn-sm btn-danger" :disabled="deletingSlug === g.slug" @click="onDeleteGame(g.slug)">
            {{ deletingSlug === g.slug ? '...' : 'Supprimer' }}
          </button>
        </li>
      </ul>
    </section>
  </div>
</template>

<style scoped>
.profile-page {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.profile-header {
  display: flex;
  align-items: center;
  gap: 1rem;
  margin-bottom: 2rem;
}

.avatar {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 800;
  font-size: 1.5rem;
  overflow: hidden;
  flex-shrink: 0;
}

.avatar img { width: 100%; height: 100%; object-fit: cover; }

.username { font-size: 1.4rem; font-weight: 800; color: var(--text); }
.email { color: var(--text-3); font-size: 0.85rem; }

.muted { color: var(--text-3); }

.global-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(140px, 1fr));
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.stat-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.1rem;
  text-align: center;
}

.stat-value { font-size: 1.6rem; font-weight: 800; color: var(--accent); margin-bottom: 0.2rem; }
.stat-label { color: var(--text-3); font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }

.favorite-game {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.9rem 1.1rem;
  margin-bottom: 1.5rem;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.12), rgba(139, 92, 246, 0.12));
  border: 1px solid var(--border-2);
  border-radius: 12px;
}

.favorite-label { font-size: 0.8rem; color: var(--text-2); font-weight: 600; }
.favorite-name { font-weight: 800; color: var(--text); }
.favorite-count { margin-left: auto; color: var(--text-3); font-size: 0.8rem; }

.detail-stats {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
  margin-bottom: 2rem;
}

.detail-card {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 12px;
  padding: 1.1rem;
}

.detail-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 0.75rem;
  padding-bottom: 0.5rem;
  border-bottom: 1px solid var(--border);
}

.detail-row {
  display: flex;
  justify-content: space-between;
  padding: 0.3rem 0;
  color: var(--text-2);
  font-size: 0.875rem;
}

.detail-row span:last-child { color: var(--text); font-weight: 600; }

.section-title {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 0.75rem;
}

.game-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }

.game-row {
  padding: 0.9rem 1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.game-name {
  display: block;
  font-weight: 700;
  color: var(--text);
  margin-bottom: 0.4rem;
}

.game-name:hover { color: var(--accent); }

.game-metrics {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem 1rem;
}

.metric { color: var(--text-3); font-size: 0.8rem; }
.metric.daily { color: rgba(217, 119, 6, 0.9); }

.my-games { margin-top: 2rem; }

.my-games-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 0.75rem;
}

.my-games-header .section-title { margin-bottom: 0; }

.my-game-row {
  display: flex;
  align-items: center;
  gap: 1rem;
}

.my-game-row .game-name { margin-bottom: 0; flex: 1; display: flex; align-items: center; gap: 0.5rem; }
.my-game-row .game-metrics { flex: none; }

.visibility-badge {
  font-size: 0.65rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
}

.visibility-badge.public { background: rgba(74, 222, 128, 0.15); color: #4ade80; }
.visibility-badge.private { background: rgba(148, 163, 184, 0.15); color: #94a3b8; }

.btn-danger {
  background: rgba(185, 28, 28, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: rgba(252, 165, 165, 0.9);
}

.btn-danger:hover:not(:disabled) { background: rgba(185, 28, 28, 0.22); color: #fff; }
</style>
