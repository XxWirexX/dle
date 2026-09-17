<script setup lang="ts">
import type { GameSummary } from '#shared/types/game'

defineProps<{ game: GameSummary }>()
</script>

<template>
  <NuxtLink :to="`/games/${game.slug}`" class="card">
    <div class="card-bg">
      <SafeImage :src="game.backgroundUrl ?? ''" :alt="game.name" :width="400" />
    </div>
    <div class="card-gradient" />
    <div class="card-icon">
      <SafeImage :src="game.iconUrl ?? ''" :alt="game.name" :width="80" />
    </div>
    <div class="card-body">
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
