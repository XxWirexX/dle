<script setup lang="ts">
import type { Character } from '#shared/types/game'

definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.slug as string

const { data: game, error } = await useFetch(`/api/games/${slug}/play`, { key: `game-play-${slug}` })

if (error.value || !game.value) {
  throw createError({ statusCode: 404, statusMessage: 'Jeu introuvable' })
}

const attributes = game.value.attributes
const characters = game.value.characters

function pickRandom(): Character {
  return characters[Math.floor(Math.random() * characters.length)]!
}

const target = ref<Character>(pickRandom())
const showHints = ref(false)
const { attempts, gameOver, won, addAttempt, reset, forfeit, guessedIds } = useGuessGame(game.value.maxAttempts)

function onGuess(character: Character) {
  if (gameOver.value) return
  const feedback = computeGuessFeedback(character, target.value, attributes)
  addAttempt(character, feedback, character.id === target.value.id)
}

function newGame() {
  target.value = pickRandom()
  reset()
}

const reveal = forfeit

const hintAttributes = computed(() => attributes.filter((a) => a.hints || a.order))
</script>

<template>
  <div v-if="game" class="game" :style="{ backgroundImage: `url(${cloudinaryUrl(game.backgroundUrl, 1600)})` }">
    <div class="overlay">
      <div class="nav">
        <NuxtLink :to="`/games/${slug}`" class="back">← {{ game.name }}</NuxtLink>
      </div>

      <header class="header">
        <h1 class="title">{{ game.name }}</h1>
        <div class="header-buttons">
          <button class="btn btn-primary" @click="newGame">Nouvelle partie</button>
          <button class="btn btn-danger" :disabled="gameOver" @click="reveal">Révéler</button>
        </div>
      </header>

      <GameSearchBar
        :characters="characters"
        :exclude-ids="guessedIds"
        :disabled="gameOver"
        @select="onGuess"
      />

      <div v-if="gameOver" class="game-over">
        <div class="game-over-character">
          <div class="portrait" :class="won ? 'win' : 'lose'">
            <SafeImage :src="target.imageUrl" :alt="target.name" :width="160" />
          </div>
        </div>
        <div class="result" :class="won ? 'win' : 'lose'">{{ won ? 'Trouvé !' : 'Dommage' }}</div>
        <div class="target-name">{{ target.name }}</div>
        <div class="stats-line">{{ attempts.length }} essai{{ attempts.length > 1 ? 's' : '' }}</div>
      </div>

      <button class="hints-toggle" @click="showHints = !showHints">
        {{ showHints ? '▲' : '▼' }} Afficher les indices
      </button>

      <div v-if="showHints" class="hints">
        <div v-for="attr in hintAttributes" :key="attr.key" class="hint-category">
          <div class="hint-title">{{ attr.label }}</div>
          <div class="hint-list">
            <span v-for="h in (attr.hints ?? attr.order)" :key="h" class="hint-item">{{ h }}</span>
          </div>
        </div>
      </div>

      <GameAttemptsTable v-if="attempts.length > 0" :attributes="attributes" :attempts="attempts" />
    </div>
  </div>
</template>

<style scoped>
.game {
  min-height: 100vh;
  background-size: cover;
  background-position: center;
  background-attachment: fixed;
}

.overlay {
  min-height: 100vh;
  background: linear-gradient(180deg, rgba(5, 5, 12, 0.68) 0%, rgba(5, 5, 12, 0.88) 60%, rgba(5, 5, 12, 0.96) 100%);
  padding: 1.5rem;
}

.nav { max-width: 1400px; margin: 0 auto 1rem; }

.back {
  color: var(--text-2);
  font-weight: 500;
  font-size: 0.875rem;
  padding: 0.4rem 0.8rem;
  border-radius: 6px;
  transition: background 0.15s;
}

.back:hover { background: rgba(255, 255, 255, 0.07); }

.header { text-align: center; margin-bottom: 1.5rem; }

.title {
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
  margin-bottom: 1.1rem;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.7);
}

.header-buttons {
  display: flex;
  gap: 0.6rem;
  justify-content: center;
}

.btn-danger {
  background: rgba(185, 28, 28, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: rgba(252, 165, 165, 0.9);
}

.btn-danger:hover:not(:disabled) { background: rgba(185, 28, 28, 0.22); color: #fff; }

.game-over {
  max-width: 30rem;
  margin: 2rem auto;
  padding: 1.75rem;
  background: rgba(8, 8, 18, 0.9);
  border: 1px solid var(--border-2);
  border-radius: 18px;
  text-align: center;
}

.portrait {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 1rem;
  border: 3px solid var(--border-2);
}

.portrait.win { border-color: rgba(74, 222, 128, 0.4); }
.portrait.lose { border-color: rgba(248, 113, 113, 0.4); }

.result { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.3rem; }
.result.win { color: #4ade80; }
.result.lose { color: #f87171; }

.target-name { color: var(--text-2); font-weight: 600; margin-bottom: 0.75rem; }
.stats-line { color: var(--text-3); font-size: 0.85rem; }

.hints-toggle {
  display: block;
  width: 100%;
  max-width: 52rem;
  margin: 1.5rem auto 0;
  padding: 0.75rem 1rem;
  background: rgba(8, 8, 18, 0.55);
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 0.8rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  border-radius: 10px;
  font-family: inherit;
}

.hints {
  max-width: 52rem;
  margin: 0.75rem auto 0;
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 0.75rem;
}

.hint-category {
  background: rgba(8, 8, 18, 0.65);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 1rem;
}

.hint-title {
  color: var(--text-2);
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  margin-bottom: 0.6rem;
  padding-bottom: 0.4rem;
  border-bottom: 1px solid var(--border);
}

.hint-list { display: flex; flex-direction: column; gap: 0.3rem; }

.hint-item {
  color: var(--text-2);
  font-size: 0.8rem;
  padding: 0.35rem 0.6rem;
  background: rgba(255, 255, 255, 0.04);
  border-radius: 6px;
  border-left: 2px solid var(--accent);
}

@media (max-width: 768px) {
  .overlay { padding: 1rem; }
  .title { font-size: 1.5rem; }
}
</style>
