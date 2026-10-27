import type { AttributeType } from '#shared/types/game'

// Import d'un jeu officiel depuis AniList : ce module ne fait aucun appel
// réseau. Le serveur récupère et normalise les persos (normalizeCharacterEdge),
// puis le client choisit ses filtres et ses champs (detectFields, buildImport)
// et pré-remplit le formulaire de création. Rien n'est lié à AniList une fois
// le jeu créé : l'admin reste libre de tout modifier.

export type AnilistMediaType = 'ANIME' | 'MANGA'
export type AnilistRole = 'MAIN' | 'SUPPORTING' | 'BACKGROUND'

export interface AnilistMediaSummary {
  id: number
  title: string
  altTitle: string | null
  format: string | null
  year: number | null
  coverUrl: string | null
}

export interface AnilistCharacter {
  anilistId: number
  name: string
  nativeName: string | null
  // null quand AniList n'a que son image par défaut
  imageUrl: string | null
  role: AnilistRole
  favourites: number
  gender: string | null
  age: string | null
  birthMonth: number | null
  bloodType: string | null
  // Lignes "__Clé:__ valeur" trouvées en tête de description
  descriptionFields: Record<string, string>
}

export interface AnilistMediaCharacters {
  media: AnilistMediaSummary
  characters: AnilistCharacter[]
}

// ─── Normalisation (côté serveur, à partir de la réponse GraphQL) ───

export interface RawCharacterEdge {
  role?: string | null
  node?: {
    id: number
    name?: { full?: string | null, native?: string | null } | null
    image?: { large?: string | null } | null
    favourites?: number | null
    gender?: string | null
    age?: string | null
    bloodType?: string | null
    dateOfBirth?: { month?: number | null } | null
    description?: string | null
  } | null
}

const DEFAULT_IMAGE_MARKER = '/default.jpg'

function nonEmpty(value: string | null | undefined): string | null {
  const trimmed = value?.trim()
  return trimmed ? trimmed : null
}

export function normalizeCharacterEdge(edge: RawCharacterEdge): AnilistCharacter | null {
  const node = edge.node
  const name = nonEmpty(node?.name?.full)
  if (!node || !name) return null

  const image = nonEmpty(node.image?.large)
  const role = edge.role === 'MAIN' || edge.role === 'SUPPORTING' ? edge.role : 'BACKGROUND'

  return {
    anilistId: node.id,
    name: name.slice(0, 80),
    nativeName: nonEmpty(node.name?.native),
    imageUrl: image && !image.includes(DEFAULT_IMAGE_MARKER) ? image : null,
    role,
    favourites: node.favourites ?? 0,
    gender: nonEmpty(node.gender),
    age: nonEmpty(node.age),
    birthMonth: node.dateOfBirth?.month ?? null,
    bloodType: nonEmpty(node.bloodType),
    descriptionFields: parseDescriptionFields(node.description),
  }
}

// ─── Parsing des descriptions ───

function cleanInline(text: string): string {
  return text
    .replace(/\[([^\]]*)\]\([^)]*\)/g, '$1') // [texte](lien) -> texte
    .replace(/__|\*\*/g, '')
    .replace(/<[^>]+>/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/**
 * Beaucoup de fiches AniList commencent par des lignes structurées
 * ("__Height:__ 174 cm", "**Affiliation:** Straw Hat Pirates"), parfois
 * dans un spoiler (~!...!~). On récupère ces paires clé/valeur ; le reste
 * de la description (le texte libre) est ignoré.
 */
export function parseDescriptionFields(description: string | null | undefined): Record<string, string> {
  if (!description) return {}

  const fields: Record<string, string> = {}
  const lines = description
    .replace(/~!|!~/g, '')
    .split(/\r?\n|<br\s*\/?>/i)

  for (const raw of lines) {
    const line = raw.trim()
    const match = line.match(/^(?:__|\*\*)([^_*\n]{1,40}?)(:?)(?:__|\*\*)\s*(:?)\s*(.+)$/)
    if (!match || (!match[2] && !match[3])) continue

    const key = cleanInline(match[1]!).replace(/:$/, '').trim()
    const value = cleanInline(match[4]!).slice(0, 120)
    if (!key || !value || key in fields) continue
    fields[key] = value
  }
  return fields
}

// ─── Champs proposés à l'import ───

export interface ImportField {
  id: string
  label: string
  type: Extract<AttributeType, 'text' | 'number'>
  source: 'builtin' | 'description'
  // Part des persos (0..1) qui ont une valeur pour ce champ
  coverage: number
  samples: string[]
  selectedByDefault: boolean
}

const MONTHS_FR = ['Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin', 'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre']

const GENDERS_FR: Record<string, string> = {
  male: 'Homme',
  female: 'Femme',
  'non-binary': 'Non-binaire',
}

const ROLES_FR: Record<AnilistRole, string> = {
  MAIN: 'Principal',
  SUPPORTING: 'Secondaire',
  BACKGROUND: 'Figurant',
}

/**
 * Premier nombre d'une valeur libre : "174 cm" -> 174, "17 (puis 19)" -> 17,
 * "3,000,000,000" -> 3000000000. null si la valeur ne commence pas par un nombre.
 */
export function parseLeadingNumber(value: string | null | undefined): number | null {
  if (!value) return null
  const match = value.trim().match(/^-?\d{1,3}(?:[ ,.]\d{3})+(?!\d)|^-?\d+(?:[.,]\d+)?/)
  if (!match) return null
  const text = match[0]
  const isThousands = /^-?\d{1,3}(?:[ ,.]\d{3})+$/.test(text) && !/^-?\d+[.,]\d{1,2}$/.test(text)
  const n = isThousands ? Number(text.replace(/[ ,.]/g, '')) : Number(text.replace(',', '.'))
  return Number.isFinite(n) ? n : null
}

interface BuiltinField {
  id: string
  label: string
  type: ImportField['type']
  defaultOn: boolean
  read: (c: AnilistCharacter) => string | number | null
}

const BUILTIN_FIELDS: BuiltinField[] = [
  {
    id: 'gender',
    label: 'Genre',
    type: 'text',
    defaultOn: true,
    read: (c) => (c.gender ? GENDERS_FR[c.gender.toLowerCase()] ?? c.gender : null),
  },
  { id: 'age', label: 'Âge', type: 'number', defaultOn: true, read: (c) => parseLeadingNumber(c.age) },
  {
    id: 'birth_month',
    label: 'Mois de naissance',
    type: 'text',
    defaultOn: false,
    read: (c) => (c.birthMonth ? MONTHS_FR[c.birthMonth - 1] ?? null : null),
  },
  { id: 'blood_type', label: 'Groupe sanguin', type: 'text', defaultOn: false, read: (c) => c.bloodType },
  { id: 'role', label: 'Rôle', type: 'text', defaultOn: true, read: (c) => ROLES_FR[c.role] },
  { id: 'favourites', label: 'Popularité (favoris AniList)', type: 'number', defaultOn: false, read: (c) => c.favourites },
]

// Clés de description qui doublonnent un champ déjà proposé plus haut :
// toujours proposées, mais pas cochées par défaut.
const DUPLICATE_DESCRIPTION_KEYS = new Set(['age', 'gender', 'sex', 'birthday', 'date of birth', 'blood type', 'bloodtype'])

const DESCRIPTION_PREFIX = 'desc:'

function descriptionKeyId(key: string): string {
  return DESCRIPTION_PREFIX + key.toLowerCase()
}

/** Valeur d'un champ pour un perso, sous la forme attendue par le formulaire. */
export function readFieldValue(field: Pick<ImportField, 'id' | 'type'>, character: AnilistCharacter): string | number | null {
  const builtin = BUILTIN_FIELDS.find((b) => b.id === field.id)
  let value: string | number | null
  if (builtin) {
    value = builtin.read(character)
  } else {
    const wanted = field.id.slice(DESCRIPTION_PREFIX.length)
    const key = Object.keys(character.descriptionFields).find((k) => k.toLowerCase() === wanted)
    value = key ? character.descriptionFields[key]! : null
  }

  if (value === null) return null
  if (field.type === 'number') return typeof value === 'number' ? value : parseLeadingNumber(value)
  return String(value)
}

function pickSamples(values: (string | number)[]): string[] {
  const unique = [...new Set(values.map(String))]
  return unique.slice(0, 3)
}

/**
 * Liste les champs importables pour un ensemble de persos, avec leur taux de
 * remplissage. À recalculer quand les filtres changent : un champ peut être
 * bien rempli pour les persos principaux et vide pour les figurants.
 */
export function detectFields(characters: AnilistCharacter[]): ImportField[] {
  const total = characters.length || 1
  const fields: ImportField[] = []

  for (const b of BUILTIN_FIELDS) {
    const values = characters.map((c) => b.read(c)).filter((v): v is string | number => v !== null && v !== '')
    if (values.length === 0) continue
    const coverage = values.length / total
    fields.push({
      id: b.id,
      label: b.label,
      type: b.type,
      source: 'builtin',
      coverage,
      samples: pickSamples(values),
      selectedByDefault: b.defaultOn && coverage >= 0.5,
    })
  }

  // Regroupe les clés sans tenir compte de la casse ("Height" / "height"),
  // en gardant l'orthographe la plus fréquente comme libellé.
  interface KeyStats { spellings: Map<string, number>, values: string[] }
  const byKey = new Map<string, KeyStats>()
  for (const c of characters) {
    for (const [key, value] of Object.entries(c.descriptionFields)) {
      const id = key.toLowerCase()
      const entry: KeyStats = byKey.get(id) ?? { spellings: new Map(), values: [] }
      entry.spellings.set(key, (entry.spellings.get(key) ?? 0) + 1)
      entry.values.push(value)
      byKey.set(id, entry)
    }
  }

  const descriptionFields: ImportField[] = []
  for (const [id, entry] of byKey) {
    // Une clé vue sur un seul perso n'apporte rien à un DLE
    if (entry.values.length < 2) continue
    const label = [...entry.spellings.entries()].sort((a, b) => b[1] - a[1])[0]![0]
    const numeric = entry.values.filter((v) => parseLeadingNumber(v) !== null).length
    const coverage = entry.values.length / total
    descriptionFields.push({
      id: descriptionKeyId(id),
      label: label.slice(0, 60),
      type: numeric / entry.values.length >= 0.8 ? 'number' : 'text',
      source: 'description',
      coverage,
      samples: pickSamples(entry.values),
      selectedByDefault: coverage >= 0.5 && !DUPLICATE_DESCRIPTION_KEYS.has(id),
    })
  }

  descriptionFields.sort((a, b) => b.coverage - a.coverage)
  return [...fields, ...descriptionFields]
}

// ─── Filtres et construction du résultat ───

export interface ImportFilters {
  excludeBackground: boolean
  requireImage: boolean
  minFavourites: number
}

export const DEFAULT_IMPORT_FILTERS: ImportFilters = {
  excludeBackground: true,
  requireImage: true,
  minFavourites: 0,
}

export function filterCharacters(characters: AnilistCharacter[], filters: ImportFilters): AnilistCharacter[] {
  return characters.filter((c) =>
    (!filters.excludeBackground || c.role !== 'BACKGROUND')
    && (!filters.requireImage || c.imageUrl !== null)
    && c.favourites >= filters.minFavourites,
  )
}

export interface ImportSelection {
  id: string
  label: string
  type: ImportField['type']
}

export interface ImportedCharacter {
  name: string
  imageUrl: string | null
  // Valeurs indexées par id de champ (ImportSelection.id)
  values: Record<string, string | number | null>
}

/** Ce que le panneau d'import renvoie au formulaire de création. */
export interface AnilistImportResult {
  name: string
  iconUrl: string | null
  attributes: ImportSelection[]
  characters: ImportedCharacter[]
}

export function buildImportedCharacters(characters: AnilistCharacter[], selection: ImportSelection[]): ImportedCharacter[] {
  return characters.map((c) => ({
    name: c.name,
    imageUrl: c.imageUrl,
    values: Object.fromEntries(selection.map((field) => [field.id, readFieldValue(field, c)])),
  }))
}
