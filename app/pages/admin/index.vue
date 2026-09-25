<script setup lang="ts">
definePageMeta({ middleware: 'auth' })

const { user } = useAuth()
if (!user.value?.isAdmin) {
  throw createError({ statusCode: 403, statusMessage: 'Réservé aux administrateurs' })
}

const { data: allGames } = await useFetch('/api/admin/games', { key: 'admin-games' })
</script>

<template>
  <div class="admin-page">
    <h1 class="title">Admin — Jeux</h1>
    <p class="subtitle">Choisis un jeu pour éditer ses personnages (image, valeurs, ajout/suppression).</p>

    <ul class="game-list">
      <li v-for="g in allGames" :key="g.slug" class="game-row">
        <NuxtLink :to="`/admin/games/${g.slug}`" class="game-name">
          {{ g.name }}
          <span class="badge" :class="{ official: g.isOfficial }">{{ g.isOfficial ? 'Officiel' : 'Custom' }}</span>
        </NuxtLink>
        <span class="muted">{{ g.characterCount }} personnages</span>
      </li>
    </ul>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 700px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

.title { font-size: 1.5rem; font-weight: 800; color: var(--text); margin-bottom: 0.4rem; }
.subtitle { color: var(--text-2); font-size: 0.9rem; margin-bottom: 1.5rem; }

.game-list { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.5rem; }

.game-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.9rem 1.1rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.game-name { display: flex; align-items: center; gap: 0.6rem; font-weight: 700; color: var(--text); }
.game-name:hover { color: var(--accent); }

.badge {
  font-size: 0.62rem;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 0.15rem 0.5rem;
  border-radius: 999px;
  background: rgba(148, 163, 184, 0.15);
  color: #94a3b8;
}

.badge.official { background: rgba(59, 130, 246, 0.15); color: var(--accent-2); }

.muted { color: var(--text-3); font-size: 0.82rem; }
</style>
