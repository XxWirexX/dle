<script setup lang="ts">
import {
  DEFAULT_IMPORT_FILTERS,
  detectFields,
  filterCharacters,
  buildImportedCharacters,
  type AnilistMediaCharacters,
  type AnilistMediaSummary,
  type AnilistMediaType,
  type ImportField,
  type ImportFilters,
  type ImportSelection,
  type AnilistImportResult,
} from '#shared/utils/anilistImport'

const emit = defineEmits<{ apply: [result: AnilistImportResult], close: [] }>()

// Limites de POST /api/games
const MAX_CHARACTERS = 500
const MIN_CHARACTERS = 4
const MAX_ATTRIBUTES = 15

const FORMAT_LABELS: Record<string, string> = {
  TV: 'Série TV',
  TV_SHORT: 'Série courte',
  MOVIE: 'Film',
  SPECIAL: 'Spécial',
  OVA: 'OVA',
  ONA: 'ONA',
  MUSIC: 'Clip',
  MANGA: 'Manga',
  NOVEL: 'Light novel',
  ONE_SHOT: 'One shot',
}

const ROLE_LABELS = { MAIN: 'Principal', SUPPORTING: 'Secondaire', BACKGROUND: 'Figurant' } as const

// ─── Recherche ───
const query = ref('')
const mediaType = ref<AnilistMediaType>('ANIME')
const results = ref<AnilistMediaSummary[] | null>(null)
const searching = ref(false)
const error = ref('')

async function search() {
  if (!query.value.trim()) return
  searching.value = true
  error.value = ''
  try {
    results.value = await $fetch<AnilistMediaSummary[]>('/api/admin/anilist/search', {
      query: { q: query.value.trim(), type: mediaType.value },
    })
  } catch (err: any) {
    error.value = err?.data?.message || 'Recherche impossible'
  } finally {
    searching.value = false
  }
}

// ─── Récupération des persos ───
const loadingMedia = ref<AnilistMediaSummary | null>(null)
const data = ref<AnilistMediaCharacters | null>(null)

async function pickMedia(media: AnilistMediaSummary) {
  loadingMedia.value = media
  error.value = ''
  try {
    data.value = await $fetch<AnilistMediaCharacters>(`/api/admin/anilist/media/${media.id}`)
    resetConfiguration()
  } catch (err: any) {
    error.value = err?.data?.message || 'Impossible de récupérer les persos'
  } finally {
    loadingMedia.value = null
  }
}

function backToSearch() {
  data.value = null
}

// ─── Configuration ───
const filters = reactive<ImportFilters>({ ...DEFAULT_IMPORT_FILTERS })
const useCover = ref(true)

interface FieldChoice extends ImportField {
  selected: boolean
  customLabel: string
  chosenType: ImportField['type']
}

const fieldChoices = ref<FieldChoice[]>([])

const retained = computed(() => (data.value ? filterCharacters(data.value.characters, filters) : []))

// Les taux de remplissage dépendent des persos retenus : on les recalcule
// en gardant ce que l'admin a déjà coché/renommé.
watch(retained, (chars) => {
  const previous = new Map(fieldChoices.value.map((f) => [f.id, f]))
  fieldChoices.value = detectFields(chars).map((f) => {
    const prev = previous.get(f.id)
    return {
      ...f,
      selected: prev ? prev.selected : f.selectedByDefault,
      customLabel: prev ? prev.customLabel : f.label,
      chosenType: prev ? prev.chosenType : f.type,
    }
  })
})

function resetConfiguration() {
  Object.assign(filters, DEFAULT_IMPORT_FILTERS)
  useCover.value = true
  fieldChoices.value = []
}

const selectedFields = computed(() => fieldChoices.value.filter((f) => f.selected))

const blockingIssue = computed(() => {
  if (retained.value.length < MIN_CHARACTERS) return `Il faut au moins ${MIN_CHARACTERS} persos, assouplis les filtres`
  if (retained.value.length > MAX_CHARACTERS) return `Maximum ${MAX_CHARACTERS} persos par jeu : monte le seuil de favoris`
  if (selectedFields.value.length === 0) return 'Choisis au moins un champ'
  if (selectedFields.value.length > MAX_ATTRIBUTES) return `Maximum ${MAX_ATTRIBUTES} attributs par jeu`
  if (selectedFields.value.some((f) => !f.customLabel.trim())) return 'Chaque champ coché a besoin d\'un libellé'
  return ''
})

const PREVIEW_LIMIT = 48
const preview = computed(() => retained.value.slice(0, PREVIEW_LIMIT))

function percent(value: number) {
  return `${Math.round(value * 100)} %`
}

function apply() {
  if (!data.value || blockingIssue.value) return
  const selection: ImportSelection[] = selectedFields.value.map((f) => ({
    id: f.id,
    label: f.customLabel.trim().slice(0, 60),
    type: f.chosenType,
  }))
  emit('apply', {
    name: data.value.media.title,
    iconUrl: useCover.value ? data.value.media.coverUrl : null,
    attributes: selection,
    characters: buildImportedCharacters(retained.value, selection),
  })
}
</script>

<template>
  <div class="anilist-import">
    <div class="import-header">
      <h3>Partir d'AniList</h3>
      <button type="button" class="btn btn-sm" @click="emit('close')">Fermer</button>
    </div>
    <p v-if="error" class="banner banner-error">{{ error }}</p>

    <!-- 1. Choix de l'œuvre -->
    <template v-if="!data">
      <form class="search-row" @submit.prevent="search">
        <select v-model="mediaType" aria-label="Type d'œuvre">
          <option value="ANIME">Anime</option>
          <option value="MANGA">Manga</option>
        </select>
        <input v-model="query" type="search" placeholder="Ex : One Piece, Frieren..." aria-label="Titre">
        <button type="submit" class="btn btn-primary" :disabled="searching || !!loadingMedia">
          {{ searching ? 'Recherche...' : 'Chercher' }}
        </button>
      </form>

      <p v-if="loadingMedia" class="muted loading">
        Récupération des persos de <strong>{{ loadingMedia.title }}</strong>…
        Ça peut prendre jusqu'à une minute pour une longue série.
      </p>

      <p v-else-if="results && results.length === 0" class="muted">Aucun résultat.</p>

      <ul v-else-if="results" class="media-list">
        <li v-for="m in results" :key="m.id">
          <button type="button" class="media-item" @click="pickMedia(m)">
            <img v-if="m.coverUrl" :src="m.coverUrl" alt="" class="media-cover">
            <span v-else class="media-cover" />
            <span class="media-info">
              <strong>{{ m.title }}</strong>
              <span v-if="m.altTitle" class="muted">{{ m.altTitle }}</span>
              <span class="muted">
                {{ m.format ? (FORMAT_LABELS[m.format] ?? m.format) : '?' }}<template v-if="m.year"> · {{ m.year }}</template>
              </span>
            </span>
          </button>
        </li>
      </ul>
    </template>

    <!-- 2. Filtres et champs -->
    <template v-else>
      <div class="media-summary">
        <img v-if="data.media.coverUrl" :src="data.media.coverUrl" alt="" class="media-cover">
        <div>
          <strong>{{ data.media.title }}</strong>
          <p class="muted">{{ data.characters.length }} persos sur AniList</p>
          <button type="button" class="btn btn-sm" @click="backToSearch">← Autre œuvre</button>
        </div>
      </div>

      <h4>Quels persos garder ?</h4>
      <div class="filters">
        <label class="check"><input v-model="filters.excludeBackground" type="checkbox"> Sans les figurants</label>
        <label class="check"><input v-model="filters.requireImage" type="checkbox"> Avec une image uniquement</label>
        <label class="inline-field">
          Au moins
          <input v-model.number="filters.minFavourites" type="number" min="0" step="10">
          favoris
        </label>
        <label v-if="data.media.coverUrl" class="check"><input v-model="useCover" type="checkbox"> Jaquette comme icône</label>
      </div>
      <p class="count" :class="{ warn: retained.length > MAX_CHARACTERS || retained.length < MIN_CHARACTERS }">
        {{ retained.length }} persos retenus
      </p>

      <div class="preview">
        <span v-for="c in preview" :key="c.anilistId" class="preview-chip" :title="`${ROLE_LABELS[c.role]} · ${c.favourites} favoris`">
          <img v-if="c.imageUrl" :src="c.imageUrl" alt="">
          {{ c.name }}
        </span>
        <span v-if="retained.length > PREVIEW_LIMIT" class="muted">et {{ retained.length - PREVIEW_LIMIT }} autres</span>
      </div>

      <h4>Quels champs importer ?</h4>
      <p class="muted">Le taux indique la part des persos retenus qui ont une valeur. Tu pourras ajouter tes propres champs à l'étape suivante.</p>
      <div class="table-wrap">
        <table class="fields">
          <thead>
            <tr>
              <th />
              <th>Libellé</th>
              <th>Type</th>
              <th>Rempli</th>
              <th>Exemples</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="f in fieldChoices" :key="f.id" :class="{ off: !f.selected }">
              <td><input v-model="f.selected" type="checkbox" :aria-label="`Importer ${f.label}`"></td>
              <td>
                <input v-model="f.customLabel" type="text" maxlength="60" class="label-input">
                <span v-if="f.source === 'description'" class="source">description</span>
              </td>
              <td>
                <select v-model="f.chosenType">
                  <option value="text">Texte</option>
                  <option value="number">Nombre</option>
                </select>
              </td>
              <td class="coverage">{{ percent(f.coverage) }}</td>
              <td class="muted samples">{{ f.samples.join(' · ') }}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div class="import-footer">
        <span v-if="blockingIssue" class="warn">{{ blockingIssue }}</span>
        <span v-else class="muted">{{ retained.length }} persos · {{ selectedFields.length }} attributs</span>
        <button type="button" class="btn btn-primary" :disabled="!!blockingIssue" @click="apply">
          Remplir le formulaire
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.anilist-import {
  padding: 1rem;
  margin-bottom: 1rem;
  background: rgba(59, 130, 246, 0.05);
  border: 1px solid rgba(59, 130, 246, 0.25);
  border-radius: 10px;
}

.import-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 0.75rem; }

h3 { margin: 0; font-size: 1rem; }
h4 { margin: 1.25rem 0 0.5rem; font-size: 0.8rem; text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-2); }

.muted { color: var(--text-3); font-size: 0.8rem; margin: 0; }
.warn { color: #fca5a5; font-size: 0.85rem; }

.search-row { display: flex; gap: 0.5rem; }
.search-row input { flex: 1; min-width: 0; }

input[type="search"], input[type="text"], input[type="number"], select {
  padding: 0.5rem 0.65rem;
  border-radius: 7px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: inherit;
  font-size: 0.88rem;
}

.loading { margin-top: 0.75rem; }

.media-list { list-style: none; padding: 0; margin: 0.75rem 0 0; display: grid; gap: 0.4rem; }

.media-item {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  width: 100%;
  padding: 0.45rem;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: transparent;
  color: var(--text);
  font-family: inherit;
  text-align: left;
  cursor: pointer;
}

.media-item:hover { border-color: var(--accent); background: var(--accent-dim); }

.media-cover { width: 42px; height: 60px; flex: none; border-radius: 5px; object-fit: cover; background: rgba(255, 255, 255, 0.06); }

.media-info { display: flex; flex-direction: column; gap: 0.1rem; }

.media-summary { display: flex; gap: 0.85rem; align-items: center; }
.media-summary p { margin: 0.15rem 0 0.4rem; }

.filters { display: flex; flex-wrap: wrap; gap: 0.5rem 1.25rem; align-items: center; }
.check, .inline-field { display: flex; align-items: center; gap: 0.4rem; font-size: 0.85rem; color: var(--text-2); }
.inline-field input { width: 80px; }

.count { margin: 0.6rem 0 0.4rem; font-weight: 700; }
.count.warn { color: #fca5a5; }

.preview { display: flex; flex-wrap: wrap; gap: 0.3rem; max-height: 150px; overflow-y: auto; align-items: center; }

.preview-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.15rem 0.5rem 0.15rem 0.15rem;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.05);
  font-size: 0.75rem;
  color: var(--text-2);
}

.preview-chip img { width: 20px; height: 20px; border-radius: 50%; object-fit: cover; }

.table-wrap { overflow-x: auto; }

.fields { border-collapse: collapse; width: 100%; min-width: 560px; margin-top: 0.5rem; }
.fields th, .fields td { padding: 0.4rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; font-size: 0.85rem; }
.fields th { font-size: 0.68rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; }
.fields tr.off { opacity: 0.5; }

.label-input { width: 100%; min-width: 140px; }
.source { display: block; font-size: 0.65rem; color: var(--text-3); margin-top: 0.15rem; }
.coverage { font-variant-numeric: tabular-nums; white-space: nowrap; }
.samples { max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

.import-footer { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-top: 1rem; }

@media (max-width: 640px) {
  .search-row { flex-wrap: wrap; }
  .import-footer { flex-direction: column; align-items: stretch; }
}
</style>
