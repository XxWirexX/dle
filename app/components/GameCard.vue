<script setup lang="ts">
import type { GameSummary } from '#shared/types/game'

const props = defineProps<{ game: GameSummary; dailyStreak?: number; dailyDone?: boolean }>()

const { user } = useAuth()
const { isFavorite, toggle } = useFavorites()

function onToggleFavorite(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  toggle(props.game.slug, props.game.id)
}

// Un <a> ne peut pas être imbriqué dans un autre <a> (HTML invalide, cause
// une erreur d'hydratation) — la carte entière est déjà un NuxtLink, donc
// ce lien secondaire est un bouton qui navigue manuellement.
function onDailyClick(e: Event) {
  e.preventDefault()
  e.stopPropagation()
  navigateTo(`/games/${props.game.slug}/daily`)
}
</script>

<template>
  <NuxtLink :to="`/games/${game.slug}`" class="card">
    <div class="card-bg">
      <SafeImage :src="game.backgroundUrl ?? ''" :alt="game.name" :width="400" />
    </div>
    <div class="card-gradient" />
    <div class="card-icon">
      <SafeImage :src="game.iconUrl ?? ''" :alt="game.name" :width="80" />
      <button
        v-if="dailyDone === false"
        class="daily-dot"
        title="Défi du jour pas encore fait"
        aria-label="Défi du jour pas encore fait"
        @click="onDailyClick"
      />
    </div>
    <button
      v-if="user"
      class="favorite-btn"
      :class="{ active: isFavorite(game.id) }"
      :aria-label="isFavorite(game.id) ? 'Retirer des favoris' : 'Ajouter aux favoris'"
      @click="onToggleFavorite"
    >
      {{ isFavorite(game.id) ? '★' : '☆' }}
    </button>
    <div class="card-body">
      <div v-if="dailyStreak && dailyStreak > 0" class="card-actions">
        <span class="streak-badge">🔥 {{ dailyStreak }}</span>
      </div>
      <h3 class="card-title">{{ game.name }}</h3>
      <span class="card-meta">{{ game.characterCount }} personnages · {{ game.attributeCount }} attributs</span>
    </div>
  </NuxtLink>
</template>

<style scoped>
.card {
  position: relative;
  aspect-ratio: 2 / 3;
  border-radius: 12px;
  overflow: hidden;
  background: #111;
  transition: transform 0.25s ease, box-shadow 0.25s ease;
  display: block;
}

.card:hover {
  transform: translateY(-6px);
  box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6);
  z-index: 2;
}

.card-bg {
  position: absolute;
  inset: 0;
}

.card-gradient {
  position: absolute;
  inset: 0;
  background: linear-gradient(to bottom, rgba(0, 0, 0, 0.05) 0%, rgba(0, 0, 0, 0.2) 40%, rgba(0, 0, 0, 0.85) 75%, rgba(0, 0, 0, 0.98) 100%);
}

.card-icon {
  position: absolute;
  top: 10px;
  left: 10px;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  overflow: hidden;
  border: 1.5px solid rgba(255, 255, 255, 0.25);
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.5);
}

.card-body {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  padding: 0.85rem;
}

.favorite-btn {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.5);
  border: none;
  color: rgba(255, 255, 255, 0.7);
  font-size: 1.1rem;
  line-height: 1;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, transform 0.15s;
}

.favorite-btn:hover { background: rgba(0, 0, 0, 0.7); transform: scale(1.1); }
.favorite-btn.active { color: #facc15; }

.card-actions {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  margin-bottom: 0.4rem;
}

.daily-dot {
  position: absolute;
  bottom: -3px;
  right: -3px;
  width: 12px;
  height: 12px;
  border-radius: 50%;
  background: var(--accent);
  border: 2px solid var(--bg);
  padding: 0;
  cursor: pointer;
  box-shadow: 0 0 0 2px rgba(59, 130, 246, 0.35);
}

.streak-badge {
  font-size: 0.68rem;
  font-weight: 700;
  color: #fbbf24;
  text-shadow: 0 1px 4px rgba(0, 0, 0, 0.8);
}

.card-title {
  color: #fff;
  font-size: 0.95rem;
  font-weight: 700;
  margin: 0 0 0.2rem;
  line-height: 1.25;
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.9);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-meta {
  display: block;
  color: rgba(255, 255, 255, 0.55);
  font-size: 0.68rem;
}
</style>
