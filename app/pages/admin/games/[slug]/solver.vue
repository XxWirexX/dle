<script setup lang="ts">
import type { OpenerStats, SolverTreeNode } from '#shared/utils/solver'
import type { GameDetail } from '#shared/types/game'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const slug = route.params.slug as string
const { user } = useAuth()
if (!user.value?.isAdmin) {
  throw createError({ statusCode: 403, statusMessage: 'Réservé aux administrateurs' })
}

const { data: gameDetail, error: detailError } = await useFetch<GameDetail>(`/api/games/${slug}`, { key: `admin-solver-game-${slug}` })
if (detailError.value || !gameDetail.value) {
  throw createError({ statusCode: 404, statusMessage: 'Jeu introuvable' })
}

const maxDepth = ref(2)
const rootId = ref<number | null>(null)

interface SolverResponse {
  stats: OpenerStats[]
  tree: SolverTreeNode
  nodesComputed: number
  budgetExceeded: boolean
  computeTimeMs: number
}

const { data, pending, error, refresh } = await useFetch<SolverResponse>(`/api/admin/games/${slug}/solver`, {
  query: computed(() => ({ maxDepth: maxDepth.value, rootId: rootId.value ?? undefined })),
  key: `admin-solver-${slug}`,
})

type SortKey = 'expectedRemaining' | 'entropyBits' | 'worstCaseBucket' | 'distinctPatterns'
const sortKey = ref<SortKey>('expectedRemaining')

const sortedStats = computed(() => {
  if (!data.value) return []
  const list = [...data.value.stats]
  if (sortKey.value === 'entropyBits') list.sort((a, b) => b.entropyBits - a.entropyBits)
  else if (sortKey.value === 'worstCaseBucket') list.sort((a, b) => a.worstCaseBucket - b.worstCaseBucket)
  else if (sortKey.value === 'distinctPatterns') list.sort((a, b) => b.distinctPatterns - a.distinctPatterns)
  else list.sort((a, b) => a.expectedRemaining - b.expectedRemaining)
  return list
})

const bestOpener = computed(() => sortedStats.value.length ? [...data.value!.stats].sort((a, b) => a.expectedRemaining - b.expectedRemaining)[0] : null)

// Seuils arbitraires mais pratiques : servent juste à donner un repère
// qualitatif rapide pour comparer des DLE entre eux, pas une vérité absolue.
const difficultyLabel = computed(() => {
  const e = bestOpener.value?.expectedRemaining
  if (e === undefined || e === null) return ''
  if (e <= 2.5) return 'Facile — se résout en 2-3 coups même avec un mauvais départ'
  if (e <= 5) return 'Normal'
  return 'Difficile — beaucoup de personnages proches sur les attributs actuels'
})
</script>

<template>
  <div class="admin-page">
    <NuxtLink :to="`/admin/games/${slug}`" class="back">← {{ gameDetail!.name }}</NuxtLink>
    <h1 class="title">Solveur — {{ gameDetail!.name }}</h1>
    <p class="subtitle">
      Calcule le meilleur guess d'ouverture et un arbre de "quoi deviner ensuite" selon les couleurs obtenues.
      Tourne sur les vraies règles de feedback du jeu — rien n'est deviné.
    </p>

    <section class="meta-section controls">
      <label>
        Profondeur max
        <select v-model.number="maxDepth">
          <option :value="1">1 (juste l'ouverture)</option>
          <option :value="2">2</option>
          <option :value="3">3</option>
          <option :value="4">4</option>
        </select>
      </label>
      <label>
        Personnage de départ
        <select v-model="rootId">
          <option :value="null">Automatique (meilleur guess)</option>
          <option v-for="c in data?.stats ?? []" :key="c.id" :value="c.id">{{ c.name }}</option>
        </select>
      </label>
      <button type="button" class="btn btn-primary" :disabled="pending" @click="refresh()">
        {{ pending ? 'Calcul...' : 'Recalculer' }}
      </button>
      <span v-if="data" class="muted">{{ data.nodesComputed }} nœuds en {{ data.computeTimeMs }}ms</span>
    </section>

    <p v-if="error" class="banner banner-error">{{ error.data?.message ?? 'Erreur de calcul' }}</p>
    <p v-if="data?.budgetExceeded" class="banner banner-warning">
      Budget de calcul atteint — l'arbre a été coupé plus tôt que prévu par endroits (protège le site d'un calcul trop lourd).
    </p>

    <section v-if="data" class="meta-section">
      <h2 class="section-title">Résumé</h2>
      <div class="summary-row">
        <div class="summary-stat">
          <span class="summary-value">{{ bestOpener?.name }}</span>
          <span class="summary-label">Meilleur guess d'ouverture</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value">{{ bestOpener?.expectedRemaining.toFixed(2) }}</span>
          <span class="summary-label">Candidats restants en moyenne</span>
        </div>
        <div class="summary-stat">
          <span class="summary-value">{{ difficultyLabel }}</span>
          <span class="summary-label">Difficulté estimée</span>
        </div>
      </div>
    </section>

    <section v-if="data" class="meta-section">
      <h2 class="section-title">Classement des ouvertures ({{ sortedStats.length }} personnages)</h2>
      <div class="table-wrap">
        <table class="stats-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Personnage</th>
              <th class="sortable" :class="{ active: sortKey === 'distinctPatterns' }" @click="sortKey = 'distinctPatterns'">Motifs distincts</th>
              <th class="sortable" :class="{ active: sortKey === 'worstCaseBucket' }" @click="sortKey = 'worstCaseBucket'">Pire cas</th>
              <th class="sortable" :class="{ active: sortKey === 'expectedRemaining' }" @click="sortKey = 'expectedRemaining'">Candidats restants (moy.)</th>
              <th class="sortable" :class="{ active: sortKey === 'entropyBits' }" @click="sortKey = 'entropyBits'">Entropie (bits)</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="(s, i) in sortedStats.slice(0, 15)" :key="s.id">
              <td>{{ i + 1 }}</td>
              <td>{{ s.name }}</td>
              <td>{{ s.distinctPatterns }}</td>
              <td>{{ s.worstCaseBucket }}</td>
              <td>{{ s.expectedRemaining.toFixed(2) }}</td>
              <td>{{ s.entropyBits.toFixed(3) }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>

    <section v-if="data" class="meta-section">
      <h2 class="section-title">Arbre de décision</h2>
      <p class="tree-hint">
        Chaque ligne = une combinaison de couleurs possible, dans l'ordre :
        <strong>{{ gameDetail!.attributes.map((a) => a.label).join(', ') }}</strong>
        — survole un carré pour voir à quel attribut et quel résultat il correspond.
      </p>
      <AdminSolverTreeNode :node="data.tree" />
    </section>
  </div>
</template>

<style scoped>
.admin-page {
  max-width: 1200px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.back { color: var(--text-3); font-size: 0.85rem; display: inline-block; margin-bottom: 1rem; }
.back:hover { color: var(--text-2); }

.title { font-size: 1.4rem; font-weight: 800; color: var(--text); margin-bottom: 0.4rem; }
.subtitle { color: var(--text-3); font-size: 0.85rem; margin-bottom: 1.25rem; max-width: 60rem; }

.meta-section {
  padding: 1.25rem;
  margin-bottom: 1.75rem;
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: 14px;
}

.section-title {
  font-size: 0.72rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  text-transform: uppercase;
  color: var(--text-3);
  margin: 0 0 1rem;
}

.controls { display: flex; align-items: flex-end; gap: 1.25rem; flex-wrap: wrap; }
.controls label { display: flex; flex-direction: column; gap: 0.3rem; font-size: 0.8rem; color: var(--text-2); font-weight: 600; }
.controls select {
  padding: 0.5rem 0.6rem;
  border-radius: 7px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: inherit;
  font-size: 0.85rem;
  min-width: 180px;
}

.muted { color: var(--text-3); font-size: 0.78rem; }

.banner-warning {
  background: rgba(202, 138, 4, 0.12);
  border: 1px solid rgba(250, 204, 21, 0.3);
  color: rgba(254, 240, 138, 0.9);
  padding: 0.7rem 1rem;
  border-radius: 10px;
  font-size: 0.85rem;
  margin-bottom: 1rem;
}

.summary-row { display: flex; gap: 2rem; flex-wrap: wrap; }
.summary-stat { display: flex; flex-direction: column; gap: 0.2rem; }
.summary-value { font-size: 1.1rem; font-weight: 800; color: var(--text); }
.summary-label { font-size: 0.72rem; color: var(--text-3); }

.table-wrap { overflow-x: auto; }
.stats-table { border-collapse: collapse; width: 100%; min-width: 600px; }
.stats-table th, .stats-table td { padding: 0.5rem 0.7rem; border-bottom: 1px solid var(--border); text-align: left; }
.stats-table th { font-size: 0.68rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; }
.stats-table th.sortable { cursor: pointer; user-select: none; }
.stats-table th.sortable:hover { color: var(--text); }
.stats-table th.sortable.active { color: var(--text); }
.stats-table td { font-size: 0.85rem; color: var(--text-2); }

.tree-hint { color: var(--text-3); font-size: 0.78rem; margin-bottom: 0.9rem; }
.tree-hint strong { color: var(--text-2); }
</style>
