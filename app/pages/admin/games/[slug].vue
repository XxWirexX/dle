<script setup lang="ts">
import type { Attribute, AttributeType, AttributeValue, GamePlayData, GameDetail } from '#shared/types/game'

definePageMeta({ middleware: 'auth' })

const route = useRoute()
const slug = route.params.slug as string
const { user } = useAuth()
if (!user.value?.isAdmin) {
  throw createError({ statusCode: 403, statusMessage: 'Réservé aux administrateurs' })
}

const { uploadImage } = useImageUpload()

const [{ data: game, error: gameError, refresh: refreshGame }, { data: gameDetail, error: detailError, refresh: refreshDetail }] = await Promise.all([
  useFetch<GamePlayData>(`/api/games/${slug}/play`, { key: `admin-game-${slug}` }),
  useFetch<GameDetail>(`/api/games/${slug}`, { key: `admin-game-detail-${slug}` }),
])
if (gameError.value || !game.value || detailError.value || !gameDetail.value) {
  throw createError({ statusCode: 404, statusMessage: 'Jeu introuvable' })
}
const attributes = computed(() => game.value!.attributes)

// ─── Attributs (ajout / édition / suppression / réordonnancement) ───
interface EditableAttribute {
  id: number
  key: string
  label: string
  type: AttributeType
  order: string[]
  hints: string[]
  groupsText: string
  saving: boolean
  savedMessage: string
  savedTimer: ReturnType<typeof setTimeout> | null
  error: string
}

function toEditableAttribute(a: Attribute): EditableAttribute {
  return {
    id: a.id,
    key: a.key,
    label: a.label,
    type: a.type,
    order: [...(a.order ?? [])],
    hints: [...(a.hints ?? [])],
    groupsText: (a.groups ?? []).map((g) => g.join(', ')).join('\n'),
    saving: false,
    savedMessage: '',
    savedTimer: null,
    error: '',
  }
}

const attributeRows = ref<EditableAttribute[]>(
  game.value!.attributes.map(toEditableAttribute),
)
const attributesError = ref('')
const savingAllAttributes = ref(false)

const attributeTypes: { value: AttributeType; label: string }[] = [
  { value: 'text', label: 'Texte' },
  { value: 'number', label: 'Nombre' },
  { value: 'ordered', label: 'Ordonné' },
  { value: 'multiple', label: 'Liste (multiple)' },
  { value: 'text-group', label: 'Groupes proches' },
  { value: 'boolean', label: 'Oui / Non' },
]

function parseCommaList(text: string): string[] {
  return text.split(',').map((v) => v.trim()).filter(Boolean)
}

function parseGroups(text: string): string[][] {
  return text.split('\n').map((line) => parseCommaList(line)).filter((g) => g.length > 0)
}

async function reloadGameData() {
  await Promise.all([refreshGame(), refreshDetail()])
  attributeRows.value = game.value!.attributes.map(toEditableAttribute)
  rows.value = game.value!.characters.map(toEditable)
}

// N'enregistre qu'un attribut, sans recharger toute la page — réutilisé par
// le bouton par-ligne (qui recharge ensuite) et par "tout enregistrer" (qui
// ne recharge qu'une fois, à la fin, pour éviter N rechargements).
async function persistAttribute(row: EditableAttribute): Promise<boolean> {
  if (!row.label.trim()) {
    row.error = 'Le libellé est obligatoire'
    return false
  }
  if (row.type === 'ordered' && row.order.length < 2) {
    row.error = 'Un attribut "ordonné" a besoin d\'au moins 2 valeurs'
    return false
  }
  const groups = row.type === 'text-group' ? parseGroups(row.groupsText) : undefined
  if (row.type === 'text-group' && (!groups || groups.length < 1)) {
    row.error = 'Un attribut "groupe" a besoin d\'au moins un groupe'
    return false
  }
  row.saving = true
  row.error = ''
  row.savedMessage = ''
  try {
    await $fetch(`/api/admin/games/${slug}/attributes/${row.id}`, {
      method: 'PATCH',
      body: {
        label: row.label.trim(),
        type: row.type,
        order: row.type === 'ordered' ? row.order : undefined,
        hints: row.hints,
        groups,
      },
    })
    return true
  } catch (err: any) {
    row.error = err?.data?.message || 'Erreur lors de l\'enregistrement'
    return false
  } finally {
    row.saving = false
  }
}

async function saveAttributeRow(row: EditableAttribute) {
  const ok = await persistAttribute(row)
  if (!ok) return
  await reloadGameData()
  const saved = attributeRows.value.find((r) => r.id === row.id)
  if (saved) {
    saved.savedMessage = 'Enregistré'
    saved.savedTimer = setTimeout(() => { saved.savedMessage = '' }, 2000)
  }
}

async function saveAllAttributes() {
  savingAllAttributes.value = true
  attributesError.value = ''
  const snapshot = attributeRows.value
  const results = await Promise.all(snapshot.map((row) => persistAttribute(row)))
  const failedIds = new Set(snapshot.filter((_, i) => !results[i]).map((r) => r.id))
  await reloadGameData()
  if (failedIds.size > 0) {
    attributesError.value = `${failedIds.size} attribut(s) n'ont pas pu être enregistrés`
  }
  for (const row of attributeRows.value) {
    if (failedIds.has(row.id)) continue
    row.savedMessage = 'Enregistré'
    row.savedTimer = setTimeout(() => { row.savedMessage = '' }, 2000)
  }
  savingAllAttributes.value = false
}

async function removeAttributeRow(row: EditableAttribute) {
  if (!confirm(`Supprimer l'attribut "${row.label}" ? Sa valeur sera perdue pour tous les personnages.`)) return
  row.saving = true
  row.error = ''
  try {
    await $fetch(`/api/admin/games/${slug}/attributes/${row.id}`, { method: 'DELETE' })
    await reloadGameData()
  } catch (err: any) {
    row.error = err?.data?.message || 'Erreur lors de la suppression'
    row.saving = false
  }
}

async function moveAttribute(row: EditableAttribute, direction: -1 | 1) {
  const ids = attributeRows.value.map((r) => r.id)
  const i = ids.indexOf(row.id)
  const j = i + direction
  if (i === -1 || j < 0 || j >= ids.length) return
  ;[ids[i], ids[j]] = [ids[j]!, ids[i]!]
  attributesError.value = ''
  try {
    await $fetch(`/api/admin/games/${slug}/attributes/reorder`, { method: 'POST', body: { ids } })
    await reloadGameData()
  } catch (err: any) {
    attributesError.value = err?.data?.message || 'Erreur lors du réordonnancement'
  }
}

const newAttrLabel = ref('')
const newAttrType = ref<AttributeType>('text')
const newAttrOrder = ref<string[]>([])
const newAttrHints = ref<string[]>([])
const newAttrGroupsText = ref('')
const addingAttribute = ref(false)
const showAddAttribute = ref(false)

// Clé technique déduite du libellé (comme à la création d'un DLE) — invisible
// et immuable une fois créée, l'admin ne manipule que le libellé ensuite.
function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_+|_+$)/g, '')
    .slice(0, 40)
}

async function addAttribute() {
  const label = newAttrLabel.value.trim()
  if (!label) {
    attributesError.value = 'Le libellé est obligatoire'
    return
  }
  const key = slugifyKey(label)
  if (!key) {
    attributesError.value = 'Libellé invalide'
    return
  }
  if (attributeRows.value.some((r) => r.key === key)) {
    attributesError.value = 'Un attribut avec une clé équivalente existe déjà — choisis un libellé différent'
    return
  }
  if (newAttrType.value === 'ordered' && newAttrOrder.value.length < 2) {
    attributesError.value = 'Un attribut "ordonné" a besoin d\'au moins 2 valeurs'
    return
  }
  const groups = newAttrType.value === 'text-group' ? parseGroups(newAttrGroupsText.value) : undefined
  if (newAttrType.value === 'text-group' && (!groups || groups.length < 1)) {
    attributesError.value = 'Un attribut "groupe" a besoin d\'au moins un groupe'
    return
  }
  addingAttribute.value = true
  attributesError.value = ''
  try {
    await $fetch(`/api/admin/games/${slug}/attributes`, {
      method: 'POST',
      body: {
        key,
        label,
        type: newAttrType.value,
        order: newAttrType.value === 'ordered' ? newAttrOrder.value : undefined,
        hints: newAttrHints.value,
        groups,
      },
    })
    await reloadGameData()
    newAttrLabel.value = ''
    newAttrType.value = 'text'
    newAttrOrder.value = []
    newAttrHints.value = []
    newAttrGroupsText.value = ''
    showAddAttribute.value = false
  } catch (err: any) {
    attributesError.value = err?.data?.message || "Erreur lors de l'ajout"
  } finally {
    addingAttribute.value = false
  }
}

// ─── Infos du jeu (nom, essais max, icône, fond) ───
const metaName = ref(gameDetail.value.name)
const metaMaxAttempts = ref(gameDetail.value.maxAttempts)
const iconUrl = ref(gameDetail.value.iconUrl)
const iconPublicId = ref<string | null>(null)
const backgroundUrl = ref(gameDetail.value.backgroundUrl)
const backgroundPublicId = ref<string | null>(null)
const uploadingIcon = ref(false)
const uploadingBackground = ref(false)
const savingMeta = ref(false)
const metaSavedMessage = ref('')
const metaError = ref('')
let metaSavedTimer: ReturnType<typeof setTimeout> | null = null

async function saveMeta(message = 'Enregistré') {
  if (!metaName.value.trim()) {
    metaError.value = 'Le nom est obligatoire'
    return
  }
  savingMeta.value = true
  metaError.value = ''
  metaSavedMessage.value = ''
  try {
    await $fetch(`/api/admin/games/${slug}`, {
      method: 'PATCH',
      body: {
        name: metaName.value.trim(),
        maxAttempts: metaMaxAttempts.value,
        iconUrl: iconUrl.value,
        iconPublicId: iconPublicId.value,
        backgroundUrl: backgroundUrl.value,
        backgroundPublicId: backgroundPublicId.value,
      },
    })
    metaSavedMessage.value = message
    if (metaSavedTimer) clearTimeout(metaSavedTimer)
    metaSavedTimer = setTimeout(() => { metaSavedMessage.value = '' }, 2000)
  } catch (err: any) {
    metaError.value = err?.data?.message || 'Erreur lors de l\'enregistrement'
  } finally {
    savingMeta.value = false
  }
}

async function onMetaIconChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingIcon.value = true
  metaError.value = ''
  try {
    const result = await uploadImage(file, 'icon')
    iconUrl.value = result.url
    iconPublicId.value = result.publicId
    await saveMeta('Icône mise à jour')
  } catch {
    metaError.value = "Échec de l'upload de l'icône"
  } finally {
    uploadingIcon.value = false
  }
}

async function onMetaBackgroundChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingBackground.value = true
  metaError.value = ''
  try {
    const result = await uploadImage(file, 'background')
    backgroundUrl.value = result.url
    backgroundPublicId.value = result.publicId
    await saveMeta('Fond mis à jour')
  } catch {
    metaError.value = "Échec de l'upload du fond"
  } finally {
    uploadingBackground.value = false
  }
}

interface EditableCharacter {
  id: number | null
  name: string
  imageUrl: string | null
  imagePublicId: string | null
  values: Record<string, unknown>
  // Pour un attribut "texte" avec des indices : true = saisie libre affichée
  // au lieu du <select>, pour les valeurs qui ne correspondent à aucun indice
  // (données existantes) ou quand l'admin veut taper une valeur hors liste.
  customFields: Record<string, boolean>
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

function isValueInHints(attr: Attribute, value: unknown): boolean {
  if (!attr.hints?.length) return false
  const v = String(value ?? '').toLowerCase()
  return attr.hints.some((h) => h.toLowerCase() === v)
}

function toEditable(c: GamePlayData['characters'][number]): EditableCharacter {
  const values = Object.fromEntries(attributes.value.map((a) => [a.key, valueForInput(a, c.attributes[a.key])]))
  return {
    id: c.id,
    name: c.name,
    imageUrl: c.imageUrl,
    imagePublicId: null,
    values,
    customFields: Object.fromEntries(
      attributes.value
        .filter((a) => a.type === 'text' && a.hints?.length)
        .map((a) => [a.key, !!values[a.key] && !isValueInHints(a, values[a.key])]),
    ),
    uploading: false,
    saving: false,
    savedMessage: '',
    savedTimer: null,
    error: '',
  }
}

const rows = ref<EditableCharacter[]>(game.value.characters.map(toEditable))
const charactersError = ref('')
const savingAllCharacters = ref(false)

function newRow(): EditableCharacter {
  return {
    id: null,
    name: '',
    imageUrl: null,
    imagePublicId: null,
    values: Object.fromEntries(attributes.value.map((a) => {
      if (a.type === 'boolean') return [a.key, false]
      if (a.type === 'ordered') return [a.key, a.order?.[0] ?? '']
      return [a.key, '']
    })),
    customFields: Object.fromEntries(
      attributes.value.filter((a) => a.type === 'text' && a.hints?.length).map((a) => [a.key, false]),
    ),
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

// N'enregistre qu'un personnage, sans effet secondaire sur savedMessage —
// réutilisé par le bouton par-ligne (saveRow, qui gère le message) et par
// "tout enregistrer" (qui gère ses propres messages une fois tout fini).
async function persistCharacter(row: EditableCharacter): Promise<boolean> {
  if (!row.name.trim()) {
    row.error = 'Le nom est obligatoire'
    return false
  }
  if (!row.imageUrl) {
    row.error = 'Une image est obligatoire'
    return false
  }
  row.saving = true
  row.error = ''
  row.savedMessage = ''
  try {
    const payload = {
      name: row.name.trim(),
      imageUrl: row.imageUrl,
      imagePublicId: row.imagePublicId,
      attributes: Object.fromEntries(attributes.value.map((a) => [a.key, coerceForSubmit(a, row.values[a.key])])),
    }
    if (row.id) {
      await $fetch(`/api/admin/games/${slug}/characters/${row.id}`, { method: 'PATCH', body: payload })
    } else {
      const result = await $fetch<{ id: number }>(`/api/admin/games/${slug}/characters`, { method: 'POST', body: payload })
      row.id = result.id
    }
    return true
  } catch (err: any) {
    row.error = err?.data?.message || 'Erreur lors de l\'enregistrement'
    return false
  } finally {
    row.saving = false
  }
}

async function saveRow(row: EditableCharacter, message = 'Enregistré') {
  const ok = await persistCharacter(row)
  if (!ok) return
  row.savedMessage = message
  if (row.savedTimer) clearTimeout(row.savedTimer)
  row.savedTimer = setTimeout(() => { row.savedMessage = '' }, 2000)
}

async function saveAllCharacters() {
  savingAllCharacters.value = true
  charactersError.value = ''
  const results = await Promise.all(rows.value.map((row) => persistCharacter(row)))
  const failCount = results.filter((ok) => !ok).length
  if (failCount > 0) {
    charactersError.value = `${failCount} personnage(s) n'ont pas pu être enregistrés`
  }
  for (const [i, row] of rows.value.entries()) {
    if (!results[i]) continue
    row.savedMessage = 'Enregistré'
    if (row.savedTimer) clearTimeout(row.savedTimer)
    row.savedTimer = setTimeout(() => { row.savedMessage = '' }, 2000)
  }
  savingAllCharacters.value = false
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
    <h1 class="title">{{ game!.name }}</h1>

    <section class="meta-section">
      <h2 class="section-title">Infos du jeu</h2>
      <p v-if="metaError" class="banner banner-error">{{ metaError }}</p>
      <div class="field-row">
        <div class="field">
          <label for="meta-name">Nom</label>
          <input id="meta-name" v-model="metaName" type="text" maxlength="100">
        </div>
        <div class="field">
          <label for="meta-max-attempts">Essais max</label>
          <input id="meta-max-attempts" v-model.number="metaMaxAttempts" type="number" min="4" max="40">
        </div>
        <button type="button" class="btn btn-primary" :disabled="savingMeta" @click="saveMeta()">
          {{ savingMeta ? '...' : 'Enregistrer' }}
        </button>
        <span v-if="metaSavedMessage" class="saved-msg">✓ {{ metaSavedMessage }}</span>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Icône</label>
          <img v-if="iconUrl" :src="iconUrl" class="preview-icon" alt="">
          <input type="file" accept="image/*" :disabled="uploadingIcon" @change="onMetaIconChange">
          <span v-if="uploadingIcon" class="muted">Upload...</span>
        </div>
        <div class="field">
          <label>Image de fond</label>
          <img v-if="backgroundUrl" :src="backgroundUrl" class="preview-bg" alt="">
          <input type="file" accept="image/*" :disabled="uploadingBackground" @change="onMetaBackgroundChange">
          <span v-if="uploadingBackground" class="muted">Upload...</span>
        </div>
      </div>
    </section>

    <section class="meta-section">
      <div class="section-header">
        <h2 class="section-title">Attributs ({{ attributeRows.length }}/15)</h2>
        <button type="button" class="btn btn-sm btn-primary" :disabled="savingAllAttributes || !attributeRows.length" @click="saveAllAttributes">
          {{ savingAllAttributes ? '...' : 'Tout enregistrer' }}
        </button>
      </div>
      <p v-if="attributesError" class="banner banner-error">{{ attributesError }}</p>

      <div v-for="(row, i) in attributeRows" :key="row.id" class="attr-row">
        <div class="attr-row-main">
          <button type="button" class="btn btn-sm" :disabled="i === 0" title="Monter" @click="moveAttribute(row, -1)">↑</button>
          <button type="button" class="btn btn-sm" :disabled="i === attributeRows.length - 1" title="Descendre" @click="moveAttribute(row, 1)">↓</button>
          <input v-model="row.label" type="text" placeholder="Libellé" class="cell-input attr-label-input">
          <select v-model="row.type" class="cell-input attr-type-select">
            <option v-for="t in attributeTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <button type="button" class="btn btn-sm btn-primary" :disabled="row.saving" @click="saveAttributeRow(row)">
            {{ row.saving ? '...' : 'Enregistrer' }}
          </button>
          <button type="button" class="btn btn-sm btn-danger" :disabled="row.saving" @click="removeAttributeRow(row)">✕</button>
          <span v-if="row.savedMessage" class="saved-msg">✓ {{ row.savedMessage }}</span>
        </div>
        <div v-if="row.type === 'ordered'" class="attr-sub-field">
          <label class="attr-sub-label">Valeurs, dans l'ordre</label>
          <AdminTagListEditor v-model="row.order" placeholder="Ajouter une valeur..." />
        </div>
        <div class="attr-sub-field">
          <label class="attr-sub-label">Indices suggérés (optionnel)</label>
          <AdminTagListEditor v-model="row.hints" placeholder="Ajouter un indice..." />
        </div>
        <textarea
          v-if="row.type === 'text-group'"
          v-model="row.groupsText"
          rows="2"
          placeholder="Un groupe de valeurs 'proches' par ligne, séparées par des virgules (ex: Feu, Flamme)"
          class="attr-groups-textarea"
        />
        <span v-if="row.error" class="error-msg">{{ row.error }}</span>
      </div>

      <button v-if="!showAddAttribute" type="button" class="btn" @click="showAddAttribute = true">+ Ajouter un attribut</button>
      <div v-else class="attr-row attr-new">
        <div class="attr-row-main">
          <input v-model="newAttrLabel" type="text" placeholder="Libellé (ex: Race)" class="cell-input attr-label-input">
          <select v-model="newAttrType" class="cell-input attr-type-select">
            <option v-for="t in attributeTypes" :key="t.value" :value="t.value">{{ t.label }}</option>
          </select>
          <button type="button" class="btn btn-sm btn-primary" :disabled="addingAttribute" @click="addAttribute">
            {{ addingAttribute ? '...' : 'Créer' }}
          </button>
          <button type="button" class="btn btn-sm" @click="showAddAttribute = false">Annuler</button>
        </div>
        <div v-if="newAttrType === 'ordered'" class="attr-sub-field">
          <label class="attr-sub-label">Valeurs, dans l'ordre</label>
          <AdminTagListEditor v-model="newAttrOrder" placeholder="Ajouter une valeur..." />
        </div>
        <div class="attr-sub-field">
          <label class="attr-sub-label">Indices suggérés (optionnel)</label>
          <AdminTagListEditor v-model="newAttrHints" placeholder="Ajouter un indice..." />
        </div>
        <textarea
          v-if="newAttrType === 'text-group'"
          v-model="newAttrGroupsText"
          rows="2"
          placeholder="Un groupe de valeurs 'proches' par ligne, séparées par des virgules (ex: Feu, Flamme)"
          class="attr-groups-textarea"
        />
      </div>
    </section>

    <div class="section-header">
      <h2 class="section-title">Personnages ({{ rows.length }})</h2>
      <button type="button" class="btn btn-sm btn-primary" :disabled="savingAllCharacters || !rows.length" @click="saveAllCharacters">
        {{ savingAllCharacters ? '...' : 'Tout enregistrer' }}
      </button>
    </div>
    <p v-if="charactersError" class="banner banner-error">{{ charactersError }}</p>

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
              <div v-if="attr.type === 'text' && attr.hints?.length" class="hint-select-field">
                <select v-if="!row.customFields[attr.key]" v-model="row.values[attr.key]" class="cell-input">
                  <option value="">—</option>
                  <option v-for="h in attr.hints" :key="h" :value="h">{{ h }}</option>
                </select>
                <input v-else v-model="row.values[attr.key]" type="text" placeholder="Valeur personnalisée" class="cell-input">
                <button
                  type="button"
                  class="hint-toggle"
                  :title="row.customFields[attr.key] ? 'Revenir à la liste' : 'Saisir une valeur hors liste'"
                  @click="row.customFields[attr.key] = !row.customFields[attr.key]"
                >{{ row.customFields[attr.key] ? '☰' : '✎' }}</button>
              </div>
              <input v-else-if="attr.type === 'text' || attr.type === 'text-group' || attr.type === 'multiple'" v-model="row.values[attr.key]" type="text" class="cell-input">
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

.section-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  margin-bottom: 1rem;
}
.section-header .section-title { margin: 0; }

.field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.9rem; flex: 1; }
.field-row { display: flex; gap: 1rem; align-items: flex-end; }

.field label { font-size: 0.8rem; color: var(--text-2); font-weight: 600; }

.field input[type="text"], .field input[type="number"] {
  padding: 0.55rem 0.7rem;
  border-radius: 7px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: inherit;
  font-size: 0.9rem;
}

.preview-icon { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; margin-bottom: 0.3rem; }
.preview-bg { width: 100%; max-width: 200px; height: 60px; border-radius: 8px; object-fit: cover; margin-bottom: 0.3rem; }

.table-wrap { overflow-x: auto; margin-bottom: 0.75rem; }

.char-table { border-collapse: collapse; width: 100%; min-width: 700px; }
.char-table th, .char-table td { padding: 0.5rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; }
.char-table th { font-size: 0.7rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; }
.char-table td:has(.hint-select-field) { min-width: 190px; }

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

.attr-row {
  padding: 0.6rem 0;
  border-bottom: 1px solid var(--border);
}
.attr-row:last-of-type { border-bottom: none; }
.attr-row-main { display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap; }

.attr-label-input { min-width: 140px; max-width: 200px; }
.attr-type-select { min-width: 150px; max-width: 170px; }

.attr-sub-field { margin-top: 0.5rem; }
.attr-sub-label { display: block; font-size: 0.72rem; color: var(--text-3); margin-bottom: 0.3rem; }

.hint-select-field { display: flex; align-items: center; gap: 0.3rem; min-width: 180px; }
.hint-select-field .cell-input { flex: 1; min-width: 100px; }
.hint-toggle {
  flex-shrink: 0;
  background: rgba(255, 255, 255, 0.04);
  border: 1px solid var(--border-2);
  border-radius: 6px;
  color: var(--text-3);
  cursor: pointer;
  padding: 0.4rem 0.5rem;
  font-size: 0.8rem;
  line-height: 1;
}
.hint-toggle:hover { color: var(--text); border-color: var(--border); }

.attr-groups-textarea {
  width: 100%;
  margin-top: 0.5rem;
  padding: 0.5rem 0.6rem;
  border-radius: 6px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: inherit;
  font-size: 0.85rem;
  resize: vertical;
}

.attr-new { border: 1px dashed var(--border-2); border-radius: 10px; padding: 0.75rem; margin-top: 0.75rem; }
</style>
