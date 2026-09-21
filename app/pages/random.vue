<script setup lang="ts">
import type { Character, GamePlayData, GameSummary } from '#shared/types/game'

definePageMeta({ layout: false })

interface Attempt {
  character: Character
  feedback: ReturnType<typeof computeGuessFeedback>
}

interface RoundResult {
  slug: string
  name: string
  won: boolean
  attempts: number
}

const { data: allGames } = await useFetch<GameSummary[]>('/api/games', { key: 'games-list' })
const { user } = useAuth()

type Phase = 'setup' | 'loading' | 'playing' | 'summary'
const phase = ref<Phase>('setup')

const availableCount = computed(() => allGames.value?.length ?? 0)
const roundOptions = computed(() => [3, 5, 8].filter((n) => n <= availableCount.value))
const roundCount = ref(5)

const sequence = ref<GameSummary[]>([])
const results = ref<RoundResult[]>([])
const currentIndex = ref(0)

const currentGame = ref<GamePlayData | null>(null)
const target = ref<Character | null>(null)
const attempts = ref<Attempt[]>([])
const gameOver = ref(false)
const won = ref(false)
const showHints = ref(false)

const guessedIds = computed(() => attempts.value.map((a) => a.character.id))
const hintAttributes = computed(() => currentGame.value?.attributes.filter((a) => a.hints || a.order) ?? [])
const roundLabel = computed(() => `Manche ${currentIndex.value + 1} / ${sequence.value.length}`)

function pickRoundCount(n: number) {
  roundCount.value = n
}

async function startRun() {
  if (!allGames.value || allGames.value.length === 0) return
  const pool = [...allGames.value]
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[pool[i], pool[j]] = [pool[j] as GameSummary, pool[i] as GameSummary]
  }
  sequence.value = pool.slice(0, Math.min(roundCount.value, pool.length))
  results.value = []
  currentIndex.value = 0
  await loadRound()
}

async function loadRound() {
  const summary = sequence.value[currentIndex.value]
  if (!summary) {
    phase.value = 'summary'
    return
  }
  phase.value = 'loading'
  const data = await $fetch<GamePlayData>(`/api/games/${summary.slug}/play`)
  currentGame.value = data
  target.value = data.characters[Math.floor(Math.random() * data.characters.length)] ?? null
  attempts.value = []
  gameOver.value = false
  won.value = false
  showHints.value = false
  phase.value = 'playing'
}

async function reportStats(slug: string, roundWon: boolean, roundAttempts: number) {
  if (!user.value) return
  try {
    await $fetch(`/api/stats/${slug}`, { method: 'PUT', body: { won: roundWon, attempts: roundAttempts } })
  } catch {
    // Ne doit jamais bloquer l'enchaînement des manches.
  }
}

function finishRound() {
  if (!currentGame.value) return
  results.value.push({
    slug: currentGame.value.slug,
    name: currentGame.value.name,
    won: won.value,
    attempts: attempts.value.length,
  })
  reportStats(currentGame.value.slug, won.value, attempts.value.length)
}

function onGuess(character: Character) {
  if (gameOver.value || !currentGame.value || !target.value) return
  const feedback = computeGuessFeedback(character, target.value, currentGame.value.attributes)
  attempts.value.unshift({ character, feedback })
  if (character.id === target.value.id) {
    gameOver.value = true
    won.value = true
  } else if (attempts.value.length >= currentGame.value.maxAttempts) {
    gameOver.value = true
    won.value = false
  }
  if (gameOver.value) finishRound()
}

function reveal() {
  if (!currentGame.value || gameOver.value) return
  gameOver.value = true
  won.value = false
  finishRound()
}

async function nextRound() {
  currentIndex.value += 1
  await loadRound()
}

function restart() {
  phase.value = 'setup'
}

const totalWins = computed(() => results.value.filter((r) => r.won).length)
const totalAttemptsSum = computed(() => results.value.reduce((sum, r) => sum + r.attempts, 0))
</script>

<template>
  <div class="random-page">
    <div class="overlay">
      <div class="nav">
        <NuxtLink to="/" class="back">← Accueil</NuxtLink>
      </div>

      <!-- ─── Écran de configuration ─── -->
      <div v-if="phase === 'setup'" class="panel center">
        <h1 class="title">Mode Random</h1>
        <p class="subtitle">Enchaîne plusieurs DLE différents à la suite et vois combien tu peux en trouver.</p>

        <div v-if="availableCount < 2" class="muted">Pas assez de jeux disponibles pour ce mode.</div>
        <template v-else>
          <div class="round-picker">
            <span class="muted">Nombre de manches</span>
            <div class="round-buttons">
              <button
                v-for="n in roundOptions"
                :key="n"
                class="btn"
                :class="{ active: roundCount === n }"
                @click="pickRoundCount(n)"
              >
                {{ n }}
              </button>
            </div>
          </div>
          <button class="btn btn-primary btn-lg" @click="startRun">Lancer</button>
        </template>
      </div>

      <!-- ─── Chargement de la manche ─── -->
      <div v-else-if="phase === 'loading'" class="panel center">
        <p class="muted">Chargement de la prochaine manche...</p>
      </div>

      <!-- ─── Manche en cours ─── -->
      <div v-else-if="phase === 'playing' && currentGame" class="playing">
        <div class="progress-bar">
          <span
            v-for="(g, i) in sequence"
            :key="g.slug"
            class="progress-dot"
            :class="{
              current: i === currentIndex,
              done: i < currentIndex,
              won: results[i]?.won,
              lost: results[i] && !results[i]!.won,
            }"
          />
        </div>

        <header class="header">
          <div class="round-label">{{ roundLabel }}</div>
          <h1 class="title">{{ currentGame.name }}</h1>
          <button class="btn btn-danger" :disabled="gameOver" @click="reveal">Révéler</button>
        </header>

        <GameSearchBar
          :characters="currentGame.characters"
          :exclude-ids="guessedIds"
          :disabled="gameOver"
          @select="onGuess"
        />

        <div v-if="gameOver && target" class="game-over">
          <div class="game-over-character">
            <div class="portrait" :class="won ? 'win' : 'lose'">
              <SafeImage :src="target.imageUrl" :alt="target.name" :width="160" />
            </div>
          </div>
          <div class="result" :class="won ? 'win' : 'lose'">{{ won ? 'Trouvé !' : 'Dommage' }}</div>
          <div class="target-name">{{ target.name }}</div>
          <div class="stats-line">{{ attempts.length }} essai{{ attempts.length > 1 ? 's' : '' }}</div>
          <button class="btn btn-primary" @click="nextRound">
            {{ currentIndex + 1 < sequence.length ? 'Manche suivante' : 'Voir le résultat' }}
          </button>
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

        <GameAttemptsTable v-if="attempts.length > 0" :attributes="currentGame.attributes" :attempts="attempts" />
      </div>

      <!-- ─── Résumé final ─── -->
      <div v-else-if="phase === 'summary'" class="panel center">
        <h1 class="title">Résultat</h1>
        <div class="summary-line">{{ totalWins }} / {{ results.length }} trouvés — {{ totalAttemptsSum }} essais au total</div>

        <ul class="summary-list">
          <li v-for="r in results" :key="r.slug" class="summary-row" :class="r.won ? 'win' : 'lose'">
            <span class="summary-name">{{ r.name }}</span>
            <span class="summary-result">{{ r.won ? `Trouvé en ${r.attempts}` : 'Raté' }}</span>
          </li>
        </ul>

        <div class="summary-actions">
          <button class="btn btn-primary" @click="restart">Rejouer</button>
          <NuxtLink to="/" class="btn">Accueil</NuxtLink>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.random-page {
  min-height: 100vh;
  background: var(--bg);
}

.overlay {
  min-height: 100vh;
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

.panel.center {
  max-width: 32rem;
  margin: 4rem auto;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.25rem;
}

.title { font-size: 2rem; font-weight: 800; color: var(--text); }
.subtitle { color: var(--text-2); }
.muted { color: var(--text-3); font-size: 0.9rem; }

.round-picker { display: flex; flex-direction: column; align-items: center; gap: 0.6rem; }
.round-buttons { display: flex; gap: 0.5rem; }
.round-buttons .btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }

.btn-lg { padding: 0.85rem 2rem; font-size: 1rem; }

.progress-bar {
  display: flex;
  justify-content: center;
  gap: 0.4rem;
  max-width: 1400px;
  margin: 0 auto 1.25rem;
}

.progress-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.15);
  border: 1px solid var(--border-2);
}

.progress-dot.current { background: var(--accent); border-color: var(--accent); }
.progress-dot.done.won { background: #4ade80; border-color: #4ade80; }
.progress-dot.done.lost { background: #f87171; border-color: #f87171; }

.header { text-align: center; margin-bottom: 1.5rem; display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }

.round-label {
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
}

.header .title { font-size: 1.75rem; margin: 0; }

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
  background: var(--bg-card);
  border: 1px solid var(--border-2);
  border-radius: 18px;
  text-align: center;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
}

.portrait {
  width: 88px;
  height: 88px;
  border-radius: 50%;
  overflow: hidden;
  margin: 0 auto 0.5rem;
  border: 3px solid var(--border-2);
}

.portrait.win { border-color: rgba(74, 222, 128, 0.4); }
.portrait.lose { border-color: rgba(248, 113, 113, 0.4); }

.result { font-size: 1.75rem; font-weight: 800; margin-bottom: 0.1rem; }
.result.win { color: #4ade80; }
.result.lose { color: #f87171; }

.target-name { color: var(--text-2); font-weight: 600; }
.stats-line { color: var(--text-3); font-size: 0.85rem; margin-bottom: 0.5rem; }

.hints-toggle {
  display: block;
  width: 100%;
  max-width: 52rem;
  margin: 1.5rem auto 0;
  padding: 0.75rem 1rem;
  background: var(--bg-card);
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
  background: var(--bg-card);
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

.summary-line { color: var(--text-2); font-weight: 600; }

.summary-list {
  list-style: none;
  padding: 0;
  margin: 0;
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
}

.summary-row {
  display: flex;
  justify-content: space-between;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  background: var(--bg-card);
  border: 1px solid var(--border);
}

.summary-row.win { border-left: 3px solid #4ade80; }
.summary-row.lose { border-left: 3px solid #f87171; }

.summary-name { font-weight: 600; color: var(--text); }
.summary-result { color: var(--text-2); font-size: 0.85rem; }

.summary-actions { display: flex; gap: 0.6rem; }

@media (max-width: 768px) {
  .overlay { padding: 1rem; }
  .title { font-size: 1.5rem; }
}
</style>
