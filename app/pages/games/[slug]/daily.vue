<script setup lang="ts">
import type { Character } from '#shared/types/game'

definePageMeta({ layout: false })

const route = useRoute()
const slug = route.params.slug as string

const [{ data: game, error: gameError }, { data: daily, error: dailyError }] = await Promise.all([
  useFetch(`/api/games/${slug}/play`, { key: `game-play-${slug}` }),
  useFetch(`/api/games/${slug}/daily`, { key: `game-daily-${slug}` }),
])

if (gameError.value || dailyError.value || !game.value || !daily.value) {
  throw createError({ statusCode: 404, statusMessage: 'Jeu introuvable' })
}

const attributes = game.value.attributes
const characters = game.value.characters

const { user } = useAuth()
const showHints = ref(false)
const revealedTarget = ref<Character | null>(null)
const guessing = ref(false)
const copied = ref(false)
const { attempts, gameOver, won, addAttempt, forfeit, guessedIds } = useGuessGame(game.value.maxAttempts)

// Déjà joué aujourd'hui (rechargement de page, ou retour le même jour) :
// on verrouille direct sur le résultat plutôt que de laisser reguesser à
// l'infini — seul rempart visible, jusque-là le "une fois par jour" ne
// vivait que côté stats, invisible pour l'utilisateur.
const alreadyCompletedToday = ref(false)
const lockedAttemptsCount = ref(0)
if (daily.value.myCompletion) {
  alreadyCompletedToday.value = true
  lockedAttemptsCount.value = daily.value.myCompletion.attempts
  gameOver.value = true
  won.value = daily.value.myCompletion.won
  try {
    const result = await $fetch<{ target: Character }>(`/api/games/${slug}/daily/reveal`, { method: 'POST' })
    revealedTarget.value = result.target
  } catch {
    // Pas grave si ça échoue — l'écran "déjà joué" reste correct sans le portrait.
  }
  await loadLeaderboard()
}

// Appelé une fois de façon synchrone ici (pas dans le computed plus bas) :
// useRequestURL() a besoin du contexte Nuxt actif, indisponible si on
// l'appelle depuis une callback réévaluée plus tard.
const shareUrl = `${useRequestURL().origin}/games/${slug}/daily`

const shareText = computed(() => generateShareText({
  gameName: game.value!.name,
  dayNumber: daily.value!.dayNumber,
  attempts: attempts.value,
  attributes,
  maxAttempts: game.value!.maxAttempts,
  won: won.value,
  url: shareUrl,
}))

function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })
}

async function copyResult() {
  try {
    await navigator.clipboard.writeText(shareText.value)
    copied.value = true
    setTimeout(() => { copied.value = false }, 2000)
  } catch {
    // Presse-papiers indisponible (permissions navigateur, contexte non
    // sécurisé...) — pas grave, le texte reste affiché à l'écran.
  }
}

interface LeaderboardEntry {
  userId: number
  username: string
  avatarColor: string
  avatarImageUrl: string | null
  attempts: number
  completedAt: string
}

const leaderboard = ref<LeaderboardEntry[]>([])

async function loadLeaderboard() {
  try {
    const data = await $fetch<{ entries: LeaderboardEntry[] }>(`/api/games/${slug}/daily/leaderboard`)
    leaderboard.value = data.entries
  } catch {
    // Pas grave si ça échoue — le classement est un bonus, pas le cœur du jeu.
  }
}

async function reportCompletion() {
  if (user.value) {
    // Ordre chronologique (les tentatives sont stockées la plus récente en
    // premier) : le serveur revérifie lui-même le résultat, voir l'endpoint.
    const attemptCharacterIds = [...attempts.value].reverse().map((a) => a.character.id)
    try {
      await $fetch(`/api/games/${slug}/daily/complete`, { method: 'POST', body: { attemptCharacterIds } })
    } catch {
      // Pas grave si ça échoue (déjà comptabilisé aujourd'hui, etc.) — ça
      // ne doit jamais bloquer l'affichage du résultat au joueur.
    }
  }
  await loadLeaderboard()
}

async function onGuess(character: Character) {
  if (gameOver.value || guessing.value) return
  guessing.value = true
  try {
    const result = await $fetch(`/api/games/${slug}/daily/guess`, {
      method: 'POST',
      body: { characterId: character.id },
    })
    addAttempt(character, result.feedback, result.isCorrect)
    if (result.isCorrect) {
      revealedTarget.value = character
      await reportCompletion()
    }
  } finally {
    guessing.value = false
  }
}

async function reveal() {
  const result = await $fetch(`/api/games/${slug}/daily/reveal`, { method: 'POST' })
  revealedTarget.value = result.target as Character
  forfeit()
  await reportCompletion()
}

const hintAttributes = computed(() => attributes.filter((a) => a.hints || a.order))
const displayAttemptsCount = computed(() => alreadyCompletedToday.value ? lockedAttemptsCount.value : attempts.value.length)

// Si l'onglet reste ouvert après le changement de jour (minuit heure de
// Paris), rien ne réévalue spontanément `daily`/`attempts`/etc. — sans ça
// un défi réussi hier reste affiché indéfiniment. On revérifie
// périodiquement et au retour sur l'onglet plutôt que de traquer un
// setTimeout précis jusqu'à minuit (fragile : un onglet en arrière-plan
// peut voir ses timers retardés par le navigateur).
const loadedDate = daily.value.date
let dayCheckInterval: ReturnType<typeof setInterval> | undefined

function reloadIfNewDay() {
  if (getParisDateString() !== loadedDate) {
    window.location.reload()
  }
}

onMounted(() => {
  dayCheckInterval = setInterval(reloadIfNewDay, 60_000)
  document.addEventListener('visibilitychange', reloadIfNewDay)
})

onUnmounted(() => {
  clearInterval(dayCheckInterval)
  document.removeEventListener('visibilitychange', reloadIfNewDay)
})
</script>

<template>
  <div v-if="game && daily" class="game" :style="{ backgroundImage: `url(${cloudinaryUrl(game.backgroundUrl, 1600)})` }">
    <div class="overlay">
      <div class="nav">
        <NuxtLink :to="`/games/${slug}`" class="back">← {{ game.name }}</NuxtLink>
      </div>

      <header class="header">
        <div class="daily-badge">Défi du jour</div>
        <h1 class="title">{{ game.name }}</h1>
        <div class="daily-meta">
          <span>{{ daily.date }}</span>
          <span>·</span>
          <span>Jour n°{{ daily.dayNumber }}</span>
        </div>
      </header>

      <GameSearchBar
        :characters="characters"
        :exclude-ids="guessedIds"
        :disabled="gameOver || guessing"
        @select="onGuess"
      />

      <div v-if="gameOver" class="game-over">
        <div v-if="revealedTarget" class="game-over-character">
          <div class="portrait" :class="won ? 'win' : 'lose'">
            <SafeImage :src="revealedTarget.imageUrl" :alt="revealedTarget.name" :width="160" />
          </div>
        </div>
        <div class="result" :class="won ? 'win' : 'lose'">{{ won ? 'Trouvé !' : 'Dommage' }}</div>
        <div v-if="revealedTarget" class="target-name">{{ revealedTarget.name }}</div>
        <p v-if="alreadyCompletedToday" class="already-done">Tu as déjà fait le défi d'aujourd'hui.</p>
        <div class="stats-line">{{ displayAttemptsCount }} essai{{ displayAttemptsCount > 1 ? 's' : '' }} · reviens demain pour un nouveau défi</div>

        <div v-if="attempts.length > 0" class="share-section">
          <pre class="share-grid">{{ shareText }}</pre>
          <button class="btn btn-primary btn-sm" @click="copyResult">
            {{ copied ? '✓ Copié !' : 'Partager le résultat' }}
          </button>
        </div>

        <div v-if="leaderboard.length > 0" class="daily-leaderboard">
          <div class="leaderboard-title">Classement du jour</div>
          <ol class="leaderboard">
            <li
              v-for="(entry, i) in leaderboard"
              :key="entry.userId"
              class="leaderboard-row"
              :class="{ me: user && entry.userId === user.id }"
            >
              <span class="leaderboard-rank">{{ i + 1 }}</span>
              <span class="leaderboard-avatar" :style="{ background: entry.avatarColor }">
                <img v-if="entry.avatarImageUrl" :src="cloudinaryUrl(entry.avatarImageUrl, 48)" :alt="entry.username">
                <span v-else>{{ entry.username[0]?.toUpperCase() }}</span>
              </span>
              <span class="leaderboard-name">{{ entry.username }}</span>
              <span class="leaderboard-stat">{{ entry.attempts }} essai{{ entry.attempts > 1 ? 's' : '' }}</span>
              <span class="leaderboard-stat muted">{{ formatTime(entry.completedAt) }}</span>
            </li>
          </ol>
        </div>
      </div>
      <div v-else class="header-buttons">
        <button class="btn btn-danger" @click="reveal">Abandonner</button>
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

.daily-badge {
  display: inline-block;
  padding: 0.3rem 1rem;
  background: linear-gradient(135deg, #d97706, #b45309);
  border-radius: 999px;
  font-size: 0.68rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  color: #fff;
  margin-bottom: 0.75rem;
  text-transform: uppercase;
}

.title {
  font-size: 2rem;
  font-weight: 800;
  color: #fff;
  margin-bottom: 0.5rem;
  text-shadow: 0 2px 24px rgba(0, 0, 0, 0.7);
}

.daily-meta {
  display: flex;
  justify-content: center;
  gap: 0.5rem;
  color: var(--text-3);
  font-size: 0.875rem;
  margin-bottom: 1.25rem;
}

.header-buttons { display: flex; justify-content: center; margin-bottom: 1.25rem; }

.btn-danger {
  background: rgba(185, 28, 28, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: rgba(252, 165, 165, 0.9);
}

.btn-danger:hover:not(:disabled) { background: rgba(185, 28, 28, 0.22); color: #fff; }

.game-over {
  max-width: 30rem;
  margin: 0 auto 1.25rem;
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
.already-done { color: var(--text-3); font-size: 0.8rem; margin-bottom: 0.25rem; }
.stats-line { color: var(--text-3); font-size: 0.85rem; margin-bottom: 1.25rem; }

.share-section { display: flex; flex-direction: column; align-items: center; gap: 0.75rem; }

.share-grid {
  font-family: inherit;
  font-size: 0.95rem;
  line-height: 1.5;
  color: var(--text-2);
  white-space: pre-wrap;
  word-break: break-word;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 10px;
  padding: 0.85rem 1rem;
  margin: 0;
  text-align: left;
}

.daily-leaderboard { margin-top: 1.25rem; text-align: left; }

.leaderboard-title {
  font-size: 0.65rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin-bottom: 0.6rem;
  text-align: center;
}

.leaderboard { list-style: none; padding: 0; margin: 0; display: flex; flex-direction: column; gap: 0.4rem; max-height: 16rem; overflow-y: auto; }

.leaderboard-row {
  display: flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 8px;
}

.leaderboard-row.me { border-color: rgba(59, 130, 246, 0.4); background: rgba(59, 130, 246, 0.08); }

.leaderboard-rank { width: 1.25rem; text-align: center; font-weight: 800; color: var(--text-3); font-size: 0.8rem; flex-shrink: 0; }

.leaderboard-avatar {
  width: 26px;
  height: 26px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #fff;
  font-weight: 700;
  font-size: 0.68rem;
  overflow: hidden;
  flex-shrink: 0;
}

.leaderboard-avatar img { width: 100%; height: 100%; object-fit: cover; }

.leaderboard-name { font-weight: 700; color: var(--text); flex: 1; min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 0.85rem; }
.leaderboard-stat { font-size: 0.75rem; color: var(--text-2); white-space: nowrap; }
.leaderboard-stat.muted { color: var(--text-3); }

.hints-toggle {
  display: block;
  width: 100%;
  max-width: 52rem;
  margin: 0 auto;
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
