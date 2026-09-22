<script setup lang="ts">
import type { AttributeType } from '#shared/types/game'

definePageMeta({ middleware: 'auth' })

const router = useRouter()
const { uploadImage } = useImageUpload()

const ATTRIBUTE_TYPE_LABELS: Record<AttributeType, string> = {
  text: 'Texte (correspondance simple/partielle)',
  number: 'Nombre (plus haut / plus bas)',
  ordered: 'Ordonné (ex : dans une chronologie)',
  multiple: 'Multiple (plusieurs valeurs, recoupement partiel)',
  'text-group': 'Texte avec groupes (valeurs proches configurables)',
  boolean: 'Oui / Non',
}
const ATTRIBUTE_TYPES = Object.keys(ATTRIBUTE_TYPE_LABELS) as AttributeType[]

// ─── Étapes ───
type Step = 1 | 2 | 3
const STEP_LABELS: Record<Step, string> = { 1: 'Infos', 2: 'Attributs', 3: 'Personnages' }
const currentStep = ref<Step>(1)

// ─── Infos générales ───
const name = ref('')
const maxAttempts = ref(15)
const visibility = ref<'public' | 'private'>('public')
const iconUrl = ref<string | null>(null)
const backgroundUrl = ref<string | null>(null)
const iconPublicId = ref<string | null>(null)
const backgroundPublicId = ref<string | null>(null)
const uploadingIcon = ref(false)
const uploadingBackground = ref(false)

async function onIconChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingIcon.value = true
  try {
    const result = await uploadImage(file, 'icon')
    iconUrl.value = result.url
    iconPublicId.value = result.publicId
  } catch {
    formError.value = "Échec de l'upload de l'icône"
  } finally {
    uploadingIcon.value = false
  }
}

async function onBackgroundChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  uploadingBackground.value = true
  try {
    const result = await uploadImage(file, 'background')
    backgroundUrl.value = result.url
    backgroundPublicId.value = result.publicId
  } catch {
    formError.value = "Échec de l'upload du fond"
  } finally {
    uploadingBackground.value = false
  }
}

// ─── Attributs ───
interface DraftAttribute {
  id: string
  label: string
  type: AttributeType
  orderRaw: string
  groupRows: string[]
}

function newAttribute(): DraftAttribute {
  return { id: crypto.randomUUID(), label: '', type: 'text', orderRaw: '', groupRows: [''] }
}

const attributes = ref<DraftAttribute[]>([newAttribute()])

function addAttribute() {
  attributes.value.push(newAttribute())
}

function removeAttribute(id: string) {
  attributes.value = attributes.value.filter((a) => a.id !== id)
}

function orderValues(attr: DraftAttribute): string[] {
  return attr.orderRaw.split('\n').map((v) => v.trim()).filter(Boolean)
}

function addGroupRow(attr: DraftAttribute) {
  attr.groupRows.push('')
}

function removeGroupRow(attr: DraftAttribute, index: number) {
  attr.groupRows.splice(index, 1)
}

// ─── Personnages ───
interface DraftCharacter {
  id: string
  name: string
  imageUrl: string | null
  imagePublicId: string | null
  uploading: boolean
  values: Record<string, unknown>
}

function newCharacter(): DraftCharacter {
  return { id: crypto.randomUUID(), name: '', imageUrl: null, imagePublicId: null, uploading: false, values: {} }
}

const characters = ref<DraftCharacter[]>([newCharacter(), newCharacter(), newCharacter(), newCharacter()])

function addCharacter() {
  characters.value.push(newCharacter())
}

function removeCharacter(id: string) {
  characters.value = characters.value.filter((c) => c.id !== id)
}

async function onCharacterImage(character: DraftCharacter, e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (!file) return
  character.uploading = true
  try {
    const result = await uploadImage(file, 'character')
    character.imageUrl = result.url
    character.imagePublicId = result.publicId
  } catch {
    formError.value = `Échec de l'upload de l'image pour "${character.name || 'ce personnage'}"`
  } finally {
    character.uploading = false
  }
}

// ─── Soumission ───
const formError = ref('')
const submitting = ref(false)

function slugifyKey(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/(^_+|_+$)/g, '')
}

function validateStep1(): string | null {
  if (!name.value.trim()) return 'Donne un nom à ton DLE'
  if (uploadingIcon.value || uploadingBackground.value) return 'Attends la fin des uploads en cours'
  return null
}

function validateStep2(): string | null {
  if (attributes.value.length === 0) return 'Ajoute au moins un attribut'
  for (const a of attributes.value) {
    if (!a.label.trim()) return 'Chaque attribut a besoin d\'un libellé'
    if (a.type === 'ordered' && orderValues(a).length < 2) return `L'attribut "${a.label}" (ordonné) a besoin d'au moins 2 valeurs`
    if (a.type === 'text-group' && a.groupRows.every((g) => !g.trim())) return `L'attribut "${a.label}" (groupe) a besoin d'au moins un groupe rempli`
  }
  return null
}

function validateStep3(): string | null {
  if (characters.value.length < 4) return 'Ajoute au moins 4 personnages'
  for (const c of characters.value) {
    if (!c.name.trim()) return 'Chaque personnage a besoin d\'un nom'
    if (!c.imageUrl) return `Ajoute une image pour "${c.name || 'ce personnage'}"`
    if (c.uploading) return 'Attends la fin des uploads en cours'
  }
  return null
}

function validate(): string | null {
  return validateStep1() ?? validateStep2() ?? validateStep3()
}

// Avancer valide chaque étape traversée ; revenir en arrière est toujours
// libre (on ne punit jamais quelqu'un qui veut juste relire une étape).
function goToStep(step: Step) {
  if (step > currentStep.value) {
    for (let s = currentStep.value; s < step; s++) {
      const err = s === 1 ? validateStep1() : validateStep2()
      if (err) {
        formError.value = err
        return
      }
    }
  }
  formError.value = ''
  currentStep.value = step
}

function nextStep() {
  goToStep((currentStep.value + 1) as Step)
}

function prevStep() {
  currentStep.value = (currentStep.value - 1) as Step
}

// ─── Brouillon (localStorage) ───
// Pas de backend dédié pour un état aussi transitoire : ça évite d'avoir
// à maintenir une table + des endpoints juste pour "où j'en étais", et un
// brouillon abandonné n'a pas besoin d'être visible ailleurs qu'ici.
const DRAFT_KEY = 'dle-create-draft'
let restoringDraft = false

function saveDraft() {
  if (restoringDraft || typeof window === 'undefined') return
  try {
    localStorage.setItem(DRAFT_KEY, JSON.stringify({
      currentStep: currentStep.value,
      name: name.value,
      maxAttempts: maxAttempts.value,
      visibility: visibility.value,
      iconUrl: iconUrl.value,
      iconPublicId: iconPublicId.value,
      backgroundUrl: backgroundUrl.value,
      backgroundPublicId: backgroundPublicId.value,
      attributes: attributes.value,
      characters: characters.value,
    }))
  } catch {
    // Stockage indisponible (navigation privée, quota) : tant pis, jamais bloquant.
  }
}

function loadDraft() {
  if (typeof window === 'undefined') return
  try {
    const raw = localStorage.getItem(DRAFT_KEY)
    if (!raw) return
    const draft = JSON.parse(raw)
    restoringDraft = true
    name.value = draft.name ?? ''
    maxAttempts.value = draft.maxAttempts ?? 15
    visibility.value = draft.visibility ?? 'public'
    iconUrl.value = draft.iconUrl ?? null
    iconPublicId.value = draft.iconPublicId ?? null
    backgroundUrl.value = draft.backgroundUrl ?? null
    backgroundPublicId.value = draft.backgroundPublicId ?? null
    if (Array.isArray(draft.attributes) && draft.attributes.length > 0) attributes.value = draft.attributes
    if (Array.isArray(draft.characters) && draft.characters.length > 0) characters.value = draft.characters
    currentStep.value = draft.currentStep ?? 1
    hasRestoredDraft.value = true
  } catch {
    // Brouillon corrompu : on ignore plutôt que de planter la page.
  } finally {
    restoringDraft = false
  }
}

function clearDraft() {
  try {
    localStorage.removeItem(DRAFT_KEY)
  } catch {
    // Rien à faire de plus si le storage est indisponible.
  }
}

function discardDraft() {
  if (!confirm('Effacer le brouillon et repartir de zéro ?')) return
  clearDraft()
  location.reload()
}

const hasRestoredDraft = ref(false)

onMounted(loadDraft)

watch([name, maxAttempts, visibility, iconUrl, iconPublicId, backgroundUrl, backgroundPublicId, currentStep], saveDraft)
watch(attributes, saveDraft, { deep: true })
watch(characters, saveDraft, { deep: true })

function coerceForSubmit(attr: DraftAttribute, raw: unknown): unknown {
  if (attr.type === 'multiple') {
    return String(raw ?? '').split(',').map((v) => v.trim()).filter(Boolean)
  }
  if (attr.type === 'boolean') return raw === true
  if (attr.type === 'number') return raw === '' || raw === undefined ? null : Number(raw)
  return String(raw ?? '').trim()
}

async function onSubmit() {
  formError.value = ''
  const validationError = validate()
  if (validationError) {
    formError.value = validationError
    return
  }

  submitting.value = true
  try {
    const attrsWithKeys = attributes.value.map((a) => ({ ...a, key: slugifyKey(a.label) || 'attr' }))
    const seen = new Set<string>()
    for (const a of attrsWithKeys) {
      let key = a.key
      let i = 2
      while (seen.has(key)) key = `${a.key}_${i++}`
      a.key = key
      seen.add(key)
    }

    const payload = {
      name: name.value.trim(),
      iconUrl: iconUrl.value,
      iconPublicId: iconPublicId.value,
      backgroundUrl: backgroundUrl.value,
      backgroundPublicId: backgroundPublicId.value,
      maxAttempts: maxAttempts.value,
      visibility: visibility.value,
      attributes: attrsWithKeys.map((a) => ({
        key: a.key,
        label: a.label.trim(),
        type: a.type,
        order: a.type === 'ordered' ? orderValues(a) : undefined,
        groups: a.type === 'text-group'
          ? a.groupRows.map((g) => g.split(',').map((v) => v.trim()).filter(Boolean)).filter((g) => g.length > 0)
          : undefined,
      })),
      characters: characters.value.map((c) => ({
        name: c.name.trim(),
        imageUrl: c.imageUrl,
        imagePublicId: c.imagePublicId,
        attributes: Object.fromEntries(attrsWithKeys.map((a) => [a.key, coerceForSubmit(a, c.values[a.id])])),
      })),
    }

    const { slug } = await $fetch<{ slug: string }>('/api/games', { method: 'POST', body: payload })
    clearDraft()
    await router.push(`/games/${slug}`)
  } catch (err: any) {
    formError.value = err?.data?.message || 'Erreur lors de la création du DLE'
  } finally {
    submitting.value = false
  }
}
</script>

<template>
  <div class="create-page">
    <div class="page-header">
      <h1 class="title">Créer un DLE</h1>
      <button type="button" class="btn btn-sm discard-btn" @click="discardDraft">Effacer le brouillon</button>
    </div>
    <p v-if="hasRestoredDraft" class="banner banner-success">Brouillon repris là où tu l'avais laissé.</p>
    <p v-if="formError" class="banner banner-error">{{ formError }}</p>

    <nav class="steps">
      <button
        v-for="n in ([1, 2, 3] as const)"
        :key="n"
        type="button"
        class="step-tab"
        :class="{ active: currentStep === n }"
        @click="goToStep(n)"
      >
        <span class="step-number">{{ n }}</span>
        {{ STEP_LABELS[n] }}
      </button>
    </nav>

    <section v-if="currentStep === 1" class="section">
      <h2 class="section-title">Infos générales</h2>
      <div class="field">
        <label for="name">Nom</label>
        <input id="name" v-model="name" type="text" maxlength="100" placeholder="Ex: Mon Anime Préféré">
      </div>
      <div class="field-row">
        <div class="field">
          <label for="max-attempts">Nombre d'essais max</label>
          <input id="max-attempts" v-model.number="maxAttempts" type="number" min="4" max="40">
        </div>
        <div class="field">
          <label for="visibility">Visibilité</label>
          <select id="visibility" v-model="visibility">
            <option value="public">Public — visible par tout le monde</option>
            <option value="private">Privé — accessible uniquement par lien</option>
          </select>
        </div>
      </div>
      <div class="field-row">
        <div class="field">
          <label>Icône (optionnel)</label>
          <input type="file" accept="image/*" :disabled="uploadingIcon" @change="onIconChange">
          <span v-if="uploadingIcon" class="muted">Upload...</span>
          <img v-else-if="iconUrl" :src="iconUrl" class="preview-icon" alt="">
        </div>
        <div class="field">
          <label>Image de fond (optionnel)</label>
          <input type="file" accept="image/*" :disabled="uploadingBackground" @change="onBackgroundChange">
          <span v-if="uploadingBackground" class="muted">Upload...</span>
          <img v-else-if="backgroundUrl" :src="backgroundUrl" class="preview-bg" alt="">
        </div>
      </div>

      <div class="step-nav">
        <span />
        <button type="button" class="btn btn-primary" @click="nextStep">Suivant : Attributs →</button>
      </div>
    </section>

    <section v-if="currentStep === 2" class="section">
      <h2 class="section-title">Attributs ({{ attributes.length }})</h2>
      <div v-for="attr in attributes" :key="attr.id" class="attribute-card">
        <div class="field-row">
          <div class="field">
            <label>Libellé</label>
            <input v-model="attr.label" type="text" placeholder="Ex: Organisation">
          </div>
          <div class="field">
            <label>Type</label>
            <select v-model="attr.type">
              <option v-for="t in ATTRIBUTE_TYPES" :key="t" :value="t">{{ ATTRIBUTE_TYPE_LABELS[t] }}</option>
            </select>
          </div>
          <button type="button" class="btn btn-sm btn-danger remove-btn" @click="removeAttribute(attr.id)">✕</button>
        </div>

        <div v-if="attr.type === 'ordered'" class="field">
          <label>Valeurs dans l'ordre (une par ligne)</label>
          <textarea v-model="attr.orderRaw" rows="3" placeholder="Arc 1&#10;Arc 2&#10;Arc 3" />
        </div>

        <div v-if="attr.type === 'text-group'" class="field">
          <label>Groupes de valeurs proches (une valeur = 'proche' de toutes celles du même groupe)</label>
          <div v-for="(_, i) in attr.groupRows" :key="i" class="group-row">
            <input v-model="attr.groupRows[i]" type="text" placeholder="Ex: Homme, Garçon, Mâle">
            <button v-if="attr.groupRows.length > 1" type="button" class="btn btn-sm" @click="removeGroupRow(attr, i)">✕</button>
          </div>
          <button type="button" class="btn btn-sm" @click="addGroupRow(attr)">+ Groupe</button>
        </div>
      </div>
      <button type="button" class="btn" @click="addAttribute">+ Ajouter un attribut</button>

      <div class="step-nav">
        <button type="button" class="btn" @click="prevStep">← Précédent</button>
        <button type="button" class="btn btn-primary" @click="nextStep">Suivant : Personnages →</button>
      </div>
    </section>

    <section v-if="currentStep === 3" class="section">
      <h2 class="section-title">Personnages ({{ characters.length }})</h2>
      <div class="table-wrap">
        <table class="char-table">
          <thead>
            <tr>
              <th>Image</th>
              <th>Nom</th>
              <th v-for="attr in attributes" :key="attr.id">{{ attr.label || '(sans nom)' }}</th>
              <th />
            </tr>
          </thead>
          <tbody>
            <tr v-for="c in characters" :key="c.id">
              <td>
                <div class="char-image-cell">
                  <img v-if="c.imageUrl" :src="c.imageUrl" class="char-thumb" alt="">
                  <input type="file" accept="image/*" :disabled="c.uploading" @change="onCharacterImage(c, $event)">
                  <span v-if="c.uploading" class="muted">Upload...</span>
                </div>
              </td>
              <td><input v-model="c.name" type="text" placeholder="Nom" class="cell-input"></td>
              <td v-for="attr in attributes" :key="attr.id">
                <input v-if="attr.type === 'text' || attr.type === 'text-group'" v-model="c.values[attr.id]" type="text" class="cell-input">
                <input v-else-if="attr.type === 'number'" v-model.number="c.values[attr.id]" type="number" class="cell-input">
                <input v-else-if="attr.type === 'boolean'" v-model="c.values[attr.id]" type="checkbox">
                <input v-else-if="attr.type === 'multiple'" v-model="c.values[attr.id]" type="text" placeholder="val1, val2" class="cell-input">
                <select v-else-if="attr.type === 'ordered'" v-model="c.values[attr.id]" class="cell-input">
                  <option value="">—</option>
                  <option v-for="o in orderValues(attr)" :key="o" :value="o">{{ o }}</option>
                </select>
              </td>
              <td><button type="button" class="btn btn-sm btn-danger" @click="removeCharacter(c.id)">✕</button></td>
            </tr>
          </tbody>
        </table>
      </div>
      <button type="button" class="btn" @click="addCharacter">+ Ajouter un personnage</button>

      <div class="step-nav">
        <button type="button" class="btn" @click="prevStep">← Précédent</button>
        <button type="button" class="btn btn-primary btn-lg" :disabled="submitting" @click="onSubmit">
          {{ submitting ? 'Création...' : 'Créer le DLE' }}
        </button>
      </div>
    </section>
  </div>
</template>

<style scoped>
.create-page {
  max-width: 1100px;
  margin: 0 auto;
  padding: 2rem 1.5rem 4rem;
}

.page-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.25rem;
}

.title { font-size: 1.6rem; font-weight: 800; color: var(--text); margin: 0; }

.discard-btn { color: var(--text-3); }

.steps {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
}

.step-tab {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.6rem 1rem;
  border-radius: 8px;
  border: 1px solid var(--border);
  background: transparent;
  color: var(--text-3);
  font-weight: 600;
  font-size: 0.85rem;
  font-family: inherit;
  cursor: pointer;
  transition: background 0.15s, color 0.15s, border-color 0.15s;
}

.step-tab:hover { background: rgba(255, 255, 255, 0.04); color: var(--text-2); }

.step-tab.active {
  border-color: var(--accent);
  background: var(--accent-dim);
  color: var(--text);
}

.step-number {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 50%;
  background: rgba(255, 255, 255, 0.08);
  font-size: 0.75rem;
}

.step-tab.active .step-number { background: var(--accent); color: #fff; }

.step-nav {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-top: 1.5rem;
}

.section {
  margin-bottom: 2rem;
  padding: 1.5rem;
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

.field { display: flex; flex-direction: column; gap: 0.35rem; margin-bottom: 0.9rem; flex: 1; }
.field-row { display: flex; gap: 1rem; align-items: flex-end; }

label { font-size: 0.8rem; color: var(--text-2); font-weight: 600; }

input[type="text"], input[type="number"], select, textarea {
  padding: 0.55rem 0.7rem;
  border-radius: 7px;
  border: 1px solid var(--border-2);
  background: rgba(255, 255, 255, 0.04);
  color: var(--text);
  font-family: inherit;
  font-size: 0.9rem;
}

textarea { resize: vertical; }

.muted { color: var(--text-3); font-size: 0.8rem; }

.preview-icon { width: 48px; height: 48px; border-radius: 8px; object-fit: cover; margin-top: 0.4rem; }
.preview-bg { width: 100%; max-width: 200px; height: 60px; border-radius: 8px; object-fit: cover; margin-top: 0.4rem; }

.attribute-card {
  padding: 1rem;
  margin-bottom: 0.75rem;
  background: rgba(255, 255, 255, 0.03);
  border: 1px solid var(--border);
  border-radius: 10px;
}

.remove-btn { flex: none; margin-bottom: 0.9rem; }

.group-row { display: flex; gap: 0.5rem; margin-bottom: 0.4rem; }
.group-row input { flex: 1; }

.table-wrap { overflow-x: auto; margin-bottom: 0.75rem; }

.char-table { border-collapse: collapse; width: 100%; min-width: 600px; }
.char-table th, .char-table td { padding: 0.5rem; border-bottom: 1px solid var(--border); text-align: left; vertical-align: middle; }
.char-table th { font-size: 0.7rem; color: var(--text-3); text-transform: uppercase; letter-spacing: 0.04em; }

.cell-input { width: 100%; min-width: 90px; }

.char-image-cell { display: flex; flex-direction: column; gap: 0.3rem; min-width: 100px; }
.char-thumb { width: 40px; height: 40px; border-radius: 6px; object-fit: cover; }

.btn-danger {
  background: rgba(185, 28, 28, 0.12);
  border: 1px solid rgba(239, 68, 68, 0.3);
  color: rgba(252, 165, 165, 0.9);
}

.btn-danger:hover:not(:disabled) { background: rgba(185, 28, 28, 0.22); color: #fff; }

.btn-lg { padding: 0.85rem 2rem; font-size: 1rem; }

@media (max-width: 640px) {
  .field-row { flex-direction: column; align-items: stretch; }
}
</style>
