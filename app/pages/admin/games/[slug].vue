<script setup lang="ts">
import type { Attribute, AttributeValue, GamePlayData } from '#shared/types/game'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const slug = route.params.slug as string
const { user } = useAuth()
if (!user.value?.isAdmin) {
  throw createError({ statusCode: 403, statusMessage: 'Réservé aux administrateurs' })
}

const { uploadImage } = useImageUpload()

const { data: game, error: gameError } = await useFetch<GamePlayData>(`/api/games/${slug}/play`, { key: `admin-game-${slug}` })
if (gameError.value || !game.value) {
  throw createError({ statusCode: 404, statusMessage: 'Jeu introuvable' })
}
const attributes = game.value.attributes

interface EditableCharacter {
  id: number | null
  name: string
  imageUrl: string | null
  imagePublicId: string | null
  values: Record<string, unknown>
  uploading: boolean
  saving: boolean
  savedMessage: string
  savedTimer: ReturnType<typeof setTimeout> | null
  error: string
}

// "multiple" s'édite comme une liste séparée par des virgules — plus simple
// qu'un vrai multi-select — reconverti en tableau seulement à l'envoi.
function valueForInput(attr: Attribute, raw: AttributeValue): unknown {
  if (attr.type === 'multiple') return Array.isArray(raw) ? raw.join(', ') : ''
  if (attr.type === 'boolean') return raw === true
  return raw ?? ''
}

function toEditable(c: GamePlayData['characters'][number]): EditableCharacter {
  return {
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    imagePublicId: null,
    values: Object.fromEntries(attributes.map((a) => [a.key, valueForInput(a, c.attributes[a.key])])),
    uploading: false,
    saving: false,
    savedMessage: '',
    savedTimer: null,
    error: '',
  }
}

const rows = ref<EditableCharacter[]>(game.value.characters.map(toEditable))

function newRow(): EditableCharacter {
  return {
    id: null,
    name: '',
    imageUrl: null,
    imagePublicId: null,
    values: Object.fromEntries(attributes.map((a) => {
      if (a.type === 'boolean') return [a.key, false]
      if (a.type === 'ordered') return [a.key, a.order?.[0] ?? '']
      return [a.key, '']
    })),
    uploading: false,
    saving: false,
    savedMessage: '',
    savedTimer: null,
    error: '',
  }
}

function addRow() {
  rows.value.push(newRow())
}

function coerceForSubmit(attr: Attribute, raw: unknown): unknown {
  if (attr.type === 'multiple') {
    return String(raw ?? '').split(',').map((v) => v.trim()).filter(Boolean)
  }
  if (attr.type === 'boolean') return raw === true
  if (attr.type === 'number') return raw === '' || raw === undefined ? null : Number(raw)
  return String(raw ?? '').trim()
}

async function onImageChange(row: EditableCharacter, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  row.uploading = true
  row.error = ''
  try {
    const result = await uploadImage(file, 'character')
    row.imageUrl = result.url
    row.imagePublicId = result.publicId
    if (row.id) await saveRow(row, 'Image mise à jour')
  } catch {
    row.error = "Échec de l'upload de l'image"
  } finally {
    row.uploading = false
  }
}

async function saveRow(row: EditableCharacter, message = 'Enregistré') {
  if (!row.name.trim()) {
    row.error = 'Le nom est obligatoire'
    return
  }
  if (!row.imageUrl) {
    row.error = 'Une image est obligatoire'
    return
  }
  row.saving = true
  row.error = ''
  row.savedMessage = ''
  try {
    const payload = {
      name: row.name.trim(),
      imageUrl: row.imageUrl,
      imagePublicId: row.imagePublicId,
      attributes: Object.fromEntries(attributes.map((a) => [a.key, coerceForSubmit(a, row.values[a.key])])),
    }
    if (row.id) {
      await $fetch(`/api/admin/games/${slug}/characters/${row.id}`, { method: 'PATCH', body: payload })
    } else {
      const result = await $fetch<{ id: number }>(`/api/admin/games/${slug}/characters`, { method: 'POST', body: payload })
      row.id = result.id
    }
    row.savedMessage = message
    if (row.savedTimer) clearTimeout(row.savedTimer)
    row.savedTimer = setTimeout(() => { row.savedMessage = '' }, 2000)
  } catch (err: any) {
    row.error = err?.data?.message || 'Erreur lors de l\'enregistrement'
  } finally {
    row.saving = false
  }
}

async function removeRow(row: EditableCharacter) {
  if (!row.id) {
    rows.value = rows.value.filter((r) => r !== row)
    return
  }
  if (!confirm(`Supprimer "${row.name}" ?`)) return
  row.saving = true
  try {
    await $fetch(`/api/admin/games/${slug}/characters/${row.id}`, { method: 'DELETE' })
    rows.value = rows.value.filter((r) => r !== row)
  } catch (err: any) {
    row.error = err?.data?.message || 'Erreur lors de la suppression'
    row.saving = false
  }
}
</script>

<template>
  <div class="admin-page">
    <NuxtLink to="/admin" class="back">← Jeux</NuxtLink>
    <h1 class="title">{{ game!.name }} — Personnages ({{ rows.length }})</h1>

    <div class="table-wrap">
      <table class="char-table">
        <thead>
          <tr>
            <th>Image</th>
            <th>Nom</th>
            <th v-for="attr in attributes" :key="attr.key">{{ attr.label }}</th>
            <th />
          </tr>
        </thead>
        <tbody>
          <tr v-for="(row, i) in rows" :key="row.id ?? `new-${i}`">
            <td>
              <div class="char-image-cell">
                <img v-if="row.imageUrl" :src="row.imageUrl" class="char-thumb" alt="">
                <input type="file" accept="image/*" :disabled="row.uploading || row.saving" @change="onImageChange(row, $event)">
                <span v-if="row.uploading" class="muted">Upload...</span>
              </div>
            </td>
            <td><input v-model="row.name" type="text" placeholder="Nom" class="cell-input"></td>
            <td v-for="attr in attributes" :key="attr.key">
              <input v-if="attr.type === 'text' || attr.type === 'text-group' || attr.type === 'multiple'" v-model="row.values[attr.key]" type="text" class="cell-input">
              <input v-else-if="attr.type === 'number'" v-model.number="row.values[attr.key]" type="number" class="cell-input">
              <input v-else-if="attr.type === 'boolean'" v-model="row.values[attr.key]" type="checkbox">
              <select v-else-if="attr.type === 'ordered'" v-model="row.values[attr.key]" class="cell-input">
                <option value="">—</option>
                <option v-for="o in (attr.order ?? [])" :key="o" :value="o">{{ o }}</option>
              </select>
            </td>
            <td class="actions-cell">
              <button type="button" class="btn btn-sm btn-primary" :disabled="row.saving" @click="saveRow(row)">
                {{ row.saving ? '...' : (row.id ? 'Enregistrer' : 'Créer') }}
              </button>
              <button type="button" class="btn btn-sm btn-danger" :disabled="row.saving" @click="removeRow(row)">✕</button>
              <span v-if="row.savedMessage" class="saved-msg">✓ {{ row.savedMessage }}</span>
              <span v-if="row.error" class="error-msg">{{ row.error }}</span>
            </td>
          </tr>
        </tbody>
      </table>
    </div>

    <button type="button" class="btn" @click="addRow">+ Ajouter un personnage</button>
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

.title { font-size: 1.4rem; font-weight: 800; color: var(--text); margin-bottom: 1.25rem; }

.table-wrap { overflow-x: auto; margin-bottom: 0.75rem; }

.char-table { border-collapse: collapse; width: 100%; min-width: 700px; }
.char-table th, .char-table td { padding: 0.5rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; }
.char-table th { font-size: 0.7rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; }

.cell-input {
  width: 100%;
  min-width: 90px;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: inherit;
  font-size: 0.85rem;
}

.char-image-cell { display: flex; flex-direction: column; gap: 0.3rem; min-width: 100px; }
.char-thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; }

.muted { color: var(--text-3); font-size: 0.75rem; }

.actions-cell { display: flex; align-items: center; gap: 0.4rem; flex-wrap: wrap; min-width: 180px; }

.saved-msg { color: #4ade80; font-size: 0.78rem; font-weight: 600; }
.error-msg { color: #f87171; font-size: 0.78rem; }

.btn-danger {
  background: rgba(185, 28, 28, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: rgba(252, 165, 165, 0.9);
}

.btn-danger:hover:not(:disabled) { background: rgba(185, 28, 28, 0.22); color: #fff; }
</style>
