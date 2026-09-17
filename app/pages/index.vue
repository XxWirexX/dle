<script setup lang="ts">
const { data: games } = await useFetch('/api/games', { key: 'games-list' })
</script>

<template>
  <div class="home">
    <h2 class="section-title">Jeux disponibles</h2>
    <div class="grid">
      <GameCard v-for="game in games" :key="game.slug" :game="game" />
    </div>
  </div>
</template>

<style scoped>
.home {
  padding: 0 1.5rem 3rem;
  max-width: 1400px;
  margin: 0 auto;
}

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

@media (max-width: 480px) {
  .home { padding: 0 1rem 2rem; }
  .grid { grid-template-columns: repeat(2, 1fr); gap: 0.65rem; }
}
</style>
