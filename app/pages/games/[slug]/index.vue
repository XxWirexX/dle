<script setup lang="ts">
const route = useRoute()
const slug = route.params.slug as string

const { data: game, error } = await useFetch(`/api/games/${slug}`, { key: `game-detail-${slug}` })

if (error.value) {
  throw createError({ statusCode: 404, statusMessage: 'Jeu introuvable' })
}

const typeLabels: Record<string, string> = {
  text: 'Texte',
  number: 'Nombre',
  ordered: 'Ordonné',
  multiple: 'Multiple',
  'text-group': 'Texte (groupé)',
  boolean: 'Oui/Non',
}
</script>

<template>
  <div v-if="game" class="detail" :style="{ backgroundImage: `url(${cloudinaryUrl(game.backgroundUrl, 1600)})` }">
    <div class="overlay">
      <header class="header">
        <div class="icon"><SafeImage :src="game.iconUrl ?? ''" :alt="game.name" :width="200" /></div>
        <div class="title-section">
          <h1 class="title">{{ game.name }}</h1>
          <div class="stats">
            <div class="stat-badge">
              <span class="stat-number">{{ game.characterCount }}</span>
              <span class="stat-label">Personnages</span>
            </div>
            <div class="stat-badge">
              <span class="stat-number">{{ game.attributeCount }}</span>
              <span class="stat-label">Attributs</span>
            </div>
            <div class="stat-badge">
              <span class="stat-number">{{ game.maxAttempts }}</span>
              <span class="stat-label">Essais max</span>
            </div>
          </div>
        </div>
      </header>

      <section class="section">
        <h2 class="section-title">Modes de jeu</h2>
        <div class="modes">
          <NuxtLink :to="`/games/${slug}/play`" class="mode-card solo">
            <div class="mode-icon">S</div>
            <div class="mode-info">
              <h3>Solo</h3>
              <p>Trouve le personnage mystère en utilisant les indices</p>
            </div>
            <div class="mode-arrow">→</div>
          </NuxtLink>

          <NuxtLink :to="`/games/${slug}/daily`" class="mode-card daily">
            <div class="mode-icon">★</div>
            <div class="mode-info">
              <h3>Défi du jour</h3>
              <p>Un personnage différent chaque jour, identique pour tous</p>
            </div>
            <div class="mode-arrow">→</div>
          </NuxtLink>

          <NuxtLink :to="`/games/${slug}/multiplayer`" class="mode-card multi">
            <div class="mode-icon">M</div>
            <div class="mode-info">
              <h3>Multijoueur</h3>
              <p>Affronte 1 à 7 autres joueurs en temps réel</p>
            </div>
            <div class="mode-arrow">→</div>
          </NuxtLink>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Attributs du jeu</h2>
        <div class="attributes-grid">
          <div v-for="attr in game.attributes" :key="attr.key" class="attribute-card">
            <div class="attribute-name">{{ attr.label }}</div>
            <div class="attribute-type">{{ typeLabels[attr.type] ?? attr.type }}</div>
          </div>
        </div>
      </section>

      <section class="section">
        <h2 class="section-title">Personnages</h2>
        <div class="characters-preview">
          <div v-for="c in game.characterPreview" :key="c.id" class="character-card">
            <div class="character-image"><SafeImage :src="c.imageUrl" :alt="c.name" :width="120" /></div>
            <span class="character-name">{{ c.name }}</span>
          </div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.detail {
  min-height: 100vh;
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}

.overlay {
  min-height: 100vh;
  background: linear-gradient(180deg, rgba(5, 5, 12, 0.75) 0%, rgba(5, 5, 12, 0.9) 55%, rgba(5, 5, 12, 0.98) 100%);
}

.header {
  display: flex;
  align-items: center;
  gap: 2rem;
  padding: 3rem 2rem 2.5rem;
  max-width: 1100px;
  margin: 0 auto;
}

.icon {
  width: 110px;
  height: 110px;
  border-radius: 16px;
  overflow: hidden;
  flex-shrink: 0;
  border: 1px solid var(--border-2);
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
}

.title-section { flex: 1; min-width: 0; }

.title {
  font-size: 2.25rem;
  font-weight: 800;
  color: #fff;
  margin-bottom: 1.1rem;
  letter-spacing: -0.02em;
  text-shadow: 0 2px 20px rgba(0, 0, 0, 0.6);
}

.stats {
  display: flex;
  gap: 0.6rem;
  flex-wrap: wrap;
}

.stat-badge {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 0.65rem 1rem;
  background: rgba(255, 255, 255, 0.05);
  border: 1px solid var(--border);
  border-radius: 12px;
  min-width: 76px;
}

.stat-number { font-size: 1.4rem; font-weight: 800; color: #fff; line-height: 1; }
.stat-label { font-size: 0.58rem; font-weight: 700; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 0.2rem; }

.section {
  max-width: 1100px;
  margin: 0 auto;
  padding: 0 2rem 2.5rem;
}

.section-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 1rem;
}

.modes {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
  gap: 0.875rem;
}

.mode-card {
  display: flex;
  align-items: center;
  gap: 1.1rem;
  padding: 1.2rem 1.3rem;
  background: rgba(8, 8, 18, 0.65);
  border-radius: 14px;
  border: 1px solid var(--border);
  text-decoration: none;
  transition: transform 0.2s, border-color 0.2s;
}

.mode-card:not(.disabled):hover {
  transform: translateY(-3px);
  border-color: var(--border-2);
}

.mode-card.disabled { opacity: 0.45; cursor: not-allowed; }

.mode-icon {
  width: 42px;
  height: 42px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  flex-shrink: 0;
  background: rgba(34, 197, 94, 0.14);
  color: #4ade80;
  border: 1px solid rgba(34, 197, 94, 0.24);
}

.mode-card.daily .mode-icon { background: rgba(245, 158, 11, 0.14); color: #fbbf24; border-color: rgba(245, 158, 11, 0.24); }
.mode-card.multi .mode-icon { background: rgba(168, 85, 247, 0.14); color: #c084fc; border-color: rgba(168, 85, 247, 0.24); }

.mode-info h3 { font-size: 1rem; font-weight: 700; color: #fff; margin-bottom: 0.2rem; }
.mode-info p { color: var(--text-2); font-size: 0.8rem; margin: 0; }
.mode-arrow { margin-left: auto; color: var(--text-3); }

.attributes-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 0.75rem;
}

.attribute-card {
  padding: 0.9rem 1rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 10px;
  border: 1px solid var(--border);
}

.attribute-name { font-weight: 700; color: rgba(255, 255, 255, 0.85); margin-bottom: 0.3rem; font-size: 0.9rem; }
.attribute-type { font-size: 0.65rem; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; color: var(--accent-2); }

.characters-preview {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(90px, 1fr));
  gap: 0.75rem;
}

.character-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.4rem;
  padding: 0.75rem 0.4rem;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border);
  border-radius: 12px;
}

.character-image { width: 56px; height: 56px; border-radius: 50%; overflow: hidden; border: 2px solid var(--border-2); }
.character-name { font-size: 0.68rem; font-weight: 600; color: var(--text-2); text-align: center; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 100%; }

@media (max-width: 768px) {
  .header { flex-direction: column; text-align: center; padding: 2rem 1.25rem 1.5rem; gap: 1.25rem; }
  .stats { justify-content: center; }
  .title { font-size: 1.75rem; }
  .section { padding: 0 1.25rem 2rem; }
  .modes { grid-template-columns: 1fr; }
}
</style>
