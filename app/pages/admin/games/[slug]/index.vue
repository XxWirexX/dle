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
const syncingHints = ref(false)
const syncHintsMessage = ref('')

interface RenamePanelState {
  open: boolean
  text: string
  busy: boolean
  message: string
  error: string
}
const renamePanels = reactive<Record<number, RenamePanelState>>({})

function renamePanel(attributeId: number): RenamePanelState {
  if (!renamePanels[attributeId]) {
    renamePanels[attributeId] = { open: false, text: '', busy: false, message: '', error: '' }
  }
  return renamePanels[attributeId]
}

function parseRenameRules(text: string): { from: string, to: string | null }[] {
  return text.split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const i = line.indexOf('=>')
      if (i === -1) return { from: line.trim(), to: null }
      const from = line.slice(0, i).trim()
      const to = line.slice(i + 2).trim()
      return { from, to: to.length ? to : null }
    })
    .filter((r) => r.from.length > 0)
}

async function applyRenameValues(attributeId: number) {
  const panel = renamePanel(attributeId)
  const rules = parseRenameRules(panel.text)
  if (rules.length === 0) return
  panel.busy = true
  panel.message = ''
  panel.error = ''
  try {
    const { results } = await $fetch<{ results: { from: string, to: string | null, charactersUpdated: number }[] }>(
      `/api/admin/games/${slug}/attributes/${attributeId}/rename-value`,
      { method: 'POST', body: { rules } },
    )
    const totalChars = results.reduce((n, r) => n + r.charactersUpdated, 0)
    panel.message = `${rules.length} règle(s) appliquée(s), ${totalChars} personnage(s) mis à jour.`
    panel.text = ''
    await reloadGameData()
  } catch (err: any) {
    panel.error = err?.data?.message || 'Erreur lors du renommage'
  } finally {
    panel.busy = false
  }
}

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
        // Pour "ordonné", les valeurs ci-dessus servent déjà d'indices —
        // pas de second champ séparé à maintenir en double.
        hints: row.type === 'ordered' ? undefined : row.hints,
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

async function syncHints() {
  syncingHints.value = true
  syncHintsMessage.value = ''
  attributesError.value = ''
  try {
    const { results } = await $fetch<{ results: { attributeKey: string, attributeLabel: string, addedValues: string[] }[] }>(
      `/api/admin/games/${slug}/attributes/sync-hints`,
      { method: 'POST' },
    )
    const totalAdded = results.reduce((n, r) => n + r.addedValues.length, 0)
    syncHintsMessage.value = totalAdded === 0
      ? 'Déjà à jour — aucun indice manquant.'
      : `${totalAdded} indice(s) ajouté(s) : ${results.map((r) => `${r.attributeLabel} (${r.addedValues.join(', ')})`).join(' · ')}`
    await reloadGameData()
  } catch (err: any) {
    attributesError.value = err?.data?.message || 'Erreur lors de la synchronisation des indices'
  } finally {
    syncingHints.value = false
  }
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
        hints: newAttrType.value === 'ordered' ? undefined : newAttrHints.value,
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

function valueForInput(attr: Attribute, raw: AttributeValue): unknown {
  if (attr.type === 'multiple') return Array.isArray(raw) ? [...raw] : []
  if (attr.type === 'boolean') return raw === true
  return raw ?? ''
}

function isValueInHints(attr: Attribute, value: unknown): boolean {
  if (!attr.hints?.length) return false
  const v = String(value ?? '').toLowerCase()
  return attr.hints.some((h) => h.toLowerCase() === v)
}

// Options du <select multiple> : les indices déclarés (dans leur ordre —
// certains jeux comme Star Wars ordonnent "appearance" chronologiquement,
// on ne veut pas le casser en triant tout) puis, en plus, toute valeur déjà
// utilisée par un personnage mais absente des indices (ex: "haki" sur One
// Piece n'a pas d'indices déclarés du tout — sans ça le select serait vide).
function multipleOptions(attr: Attribute): string[] {
  const declared = attr.hints ?? []
  const seen = new Set(declared.map((h) => h.toLowerCase()))
  const extra = new Set<string>()
  for (const r of rows.value) {
    const v = r.values[attr.key]
    if (!Array.isArray(v)) continue
    for (const item of v) {
      const s = String(item ?? '').trim()
      if (s && !seen.has(s.toLowerCase())) extra.add(s)
    }
  }
  return [...declared, ...[...extra].sort((a, b) => a.localeCompare(b))]
}

function multiSelectSize(attr: Attribute): number {
  return Math.min(Math.max(multipleOptions(attr).length, 2), 6)
}

function addMultipleValue(row: EditableCharacter, attr: Attribute, e: Event) {
  const input = e.target as HTMLInputElement
  const value = input.value.trim()
  input.value = ''
  if (!value) return
  const current = Array.isArray(row.values[attr.key]) ? row.values[attr.key] as string[] : []
  if (current.some((v) => v.toLowerCase() === value.toLowerCase())) return
  row.values[attr.key] = [...current, value]
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
      if (a.type === 'multiple') return [a.key, []]
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
  if (attr.type === 'multiple') return Array.isArray(raw) ? raw : []
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
    <div class="title-row">
      <h1 class="title">{{ game!.name }}</h1>
      <NuxtLink :to="`/admin/games/${slug}/solver`" class="btn btn-sm">Solveur / stats d'ouverture</NuxtLink>
    </div>

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
          <img v-if="iconUrl" :src="cloudinaryUrl(iconUrl, 64)" class="preview-icon" alt="">
          <input type="file" accept="image/*" :disabled="uploadingIcon" @change="onMetaIconChange">
          <span v-if="uploadingIcon" class="muted">Upload...</span>
        </div>
        <div class="field">
          <label>Image de fond</label>
          <img v-if="backgroundUrl" :src="cloudinaryUrl(backgroundUrl, 480)" class="preview-bg" alt="">
          <input type="file" accept="image/*" :disabled="uploadingBackground" @change="onMetaBackgroundChange">
          <span v-if="uploadingBackground" class="muted">Upload...</span>
        </div>
      </div>
    </section>

    <section class="meta-section">
      <div class="section-header">
        <h2 class="section-title">Attributs ({{ attributeRows.length }}/15)</h2>
        <div class="section-actions">
          <button type="button" class="btn btn-sm" :disabled="syncingHints || !attributeRows.length" title="Ajoute aux indices toute valeur déjà utilisée par un personnage mais absente de la liste" @click="syncHints">
            {{ syncingHints ? '...' : 'Synchroniser les indices' }}
          </button>
          <button type="button" class="btn btn-sm btn-primary" :disabled="savingAllAttributes || !attributeRows.length" @click="saveAllAttributes">
            {{ savingAllAttributes ? '...' : 'Tout enregistrer' }}
          </button>
        </div>
      </div>
      <p v-if="attributesError" class="banner banner-error">{{ attributesError }}</p>
      <p v-if="syncHintsMessage" class="banner banner-success">{{ syncHintsMessage }}</p>

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
          <p class="attr-sub-note">Sert aussi d'indices suggérés en jeu — pas besoin de les ressaisir ailleurs.</p>
        </div>
        <div v-else class="attr-sub-field">
          <label class="attr-sub-label">Indices suggérés (optionnel)</label>
          <AdminTagListEditor v-model="row.hints" placeholder="Ajouter un indice..." />
        </div>
        <div v-if="row.type !== 'ordered'" class="attr-sub-field">
          <button type="button" class="btn btn-sm" @click="renamePanel(row.id).open = !renamePanel(row.id).open">
            {{ renamePanel(row.id).open ? 'Fermer' : 'Fusionner / renommer des valeurs' }}
          </button>
          <div v-if="renamePanel(row.id).open" class="rename-panel">
            <p class="attr-sub-note">
              Une règle par ligne : <code>ancienne valeur =&gt; nouvelle valeur</code> renomme cette
              valeur partout où elle est utilisée par un personnage (et met à jour les indices).
              <code>ancienne valeur</code> seule (sans <code>=&gt;</code>) retire juste cet indice
              s'il n'est plus utilisé par personne.
            </p>
            <textarea
              v-model="renamePanel(row.id).text"
              rows="4"
              placeholder="Beast Pirates => Beasts Pirates&#10;Other"
              class="attr-groups-textarea"
            />
            <button type="button" class="btn btn-sm btn-primary" :disabled="renamePanel(row.id).busy || !renamePanel(row.id).text.trim()" @click="applyRenameValues(row.id)">
              {{ renamePanel(row.id).busy ? '...' : 'Appliquer' }}
            </button>
            <p v-if="renamePanel(row.id).message" class="banner banner-success">{{ renamePanel(row.id).message }}</p>
            <p v-if="renamePanel(row.id).error" class="banner banner-error">{{ renamePanel(row.id).error }}</p>
          </div>
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
          <p class="attr-sub-note">Sert aussi d'indices suggérés en jeu — pas besoin de les ressaisir ailleurs.</p>
        </div>
        <div v-else class="attr-sub-field">
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
              <div v-else-if="attr.type === 'multiple'" class="multi-select-field">
                <select v-model="row.values[attr.key]" multiple class="cell-input multi-select" :size="multiSelectSize(attr)">
                  <option v-for="opt in multipleOptions(attr)" :key="opt" :value="opt">{{ opt }}</option>
                </select>
                <input type="text" class="multi-add-input" placeholder="+ valeur" @keydown.enter.prevent="addMultipleValue(row, attr, $event)">
              </div>
              <input v-else-if="attr.type === 'text' || attr.type === 'text-group'" v-model="row.values[attr.key]" type="text" class="cell-input">
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

.title { font-size: 1.4rem; font-weight: 800; color: var(--text); margin: 0; }
.title-row { display: flex; align-items: center; justify-content: space-between; gap: 1rem; flex-wrap: wrap; margin-bottom: 1.25rem; }

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
.section-actions { display: flex; gap: 0.5rem; }

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

/* Hauteur bornée + scroll interne : avec beaucoup de personnages, la barre
   de défilement horizontale se retrouvait tout en bas d'un tableau très
   long — il fallait défiler toute la page avant de pouvoir l'atteindre.
   En bornant la hauteur, elle reste toujours juste sous les lignes
   visibles. */
.table-wrap { overflow: auto; max-height: 70vh; margin-bottom: 0.75rem; border: 1px solid var(--border); border-radius: 10px; }

.char-table { border-collapse: collapse; width: 100%; min-width: 700px; }
.char-table th, .char-table td { padding: 0.5rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; }
.char-table th { font-size: 0.7rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; position: sticky; top: 0; background: var(--bg); z-index: 1; }
.char-table td:has(.hint-select-field) { min-width: 190px; }
.char-table td:has(.multi-select-field) { min-width: 170px; }

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
.attr-sub-note { font-size: 0.72rem; color: var(--text-3); margin: 0.35rem 0 0; font-style: italic; }

.hint-select-field { display: flex; align-items: center; gap: 0.3rem; min-width: 180px; }
.hint-select-field .cell-input { flex: 1; min-width: 100px; }

.multi-select-field { display: flex; flex-direction: column; gap: 0.3rem; min-width: 150px; }
.multi-select { min-width: 150px; }
.multi-add-input {
  width: 100%;
  padding: 0.3rem 0.5rem;
  border-radius: 6px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: inherit;
  font-size: 0.78rem;
}
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

.rename-panel {
  margin-top: 0.5rem;
  padding: 0.6rem;
  border-radius: 8px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.02);
}
.rename-panel .btn { margin-top: 0.5rem; }
.rename-panel .banner { margin-top: 0.5rem; }

.attr-new { border: 1px dashed var(--border-2); border-radius: 10px; padding: 0.75rem; margin-top: 0.75rem; }
</style>
