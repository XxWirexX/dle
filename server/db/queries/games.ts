import { eq, and, or, desc, asc, sql } from 'drizzle-orm'
import { db } from '../client'
import { games, attributes, characters } from '../schema'
import type { AttributeType, GameSummary, OwnedGameSummary, GameDetail, GamePlayData, GameVisibility } from '#shared/types/game'

// Officiels + DLE custom publics : ce que tout le monde voit dans la liste.
// Un DLE custom "privé" reste jouable par quiconque a le lien (les pages de
// détail/jeu ne filtrent pas sur la visibilité), simplement absent d'ici.
export async function listPublicGames(): Promise<GameSummary[]> {
  const rows = await db.query.games.findMany({
    where: or(eq(games.isOfficial, true), eq(games.visibility, 'public')),
    orderBy: asc(games.name),
    with: {
      attributes: { columns: { id: true } },
      characters: { columns: { id: true } },
    },
  })

  return rows.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    iconUrl: g.iconUrl,
    backgroundUrl: g.backgroundUrl,
    maxAttempts: g.maxAttempts,
    characterCount: g.characters.length,
    attributeCount: g.attributes.length,
  }))
}

export async function listGamesOwnedBy(userId: number): Promise<OwnedGameSummary[]> {
  const rows = await db.query.games.findMany({
    where: eq(games.ownerId, userId),
    orderBy: desc(games.createdAt),
    with: {
      attributes: { columns: { id: true } },
      characters: { columns: { id: true } },
    },
  })

  return rows.map((g) => ({
    id: g.id,
    slug: g.slug,
    name: g.name,
    iconUrl: g.iconUrl,
    backgroundUrl: g.backgroundUrl,
    maxAttempts: g.maxAttempts,
    characterCount: g.characters.length,
    attributeCount: g.attributes.length,
    visibility: g.visibility as GameVisibility,
  }))
}

function slugify(name: string): string {
  const base = name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '')
    .slice(0, 50)
  return base || 'dle'
}

export interface CreateGameAttributeInput {
  key: string
  label: string
  type: AttributeType
  order?: string[]
  groups?: string[][]
}

export interface CreateGameCharacterInput {
  name: string
  imageUrl: string
  imagePublicId: string | null
  attributes: Record<string, unknown>
}

export interface CreateGameInput {
  // null uniquement pour un jeu officiel créé par un admin (voir isOfficial)
  // — jamais pour un DLE custom, qui garde toujours un propriétaire.
  ownerId: number | null
  isOfficial: boolean
  name: string
  iconUrl: string | null
  iconPublicId: string | null
  backgroundUrl: string | null
  backgroundPublicId: string | null
  maxAttempts: number
  visibility: GameVisibility
  attributes: CreateGameAttributeInput[]
  characters: CreateGameCharacterInput[]
}

export async function createCustomGame(input: CreateGameInput): Promise<{ slug: string }> {
  const baseSlug = slugify(input.name)
  let slug = baseSlug
  let suffix = 2
  while (await db.query.games.findFirst({ where: eq(games.slug, slug), columns: { id: true } })) {
    slug = `${baseSlug}-${suffix++}`
  }

  await db.transaction(async (tx) => {
    const [game] = await tx.insert(games).values({
      slug,
      name: input.name,
      iconUrl: input.iconUrl,
      iconPublicId: input.iconPublicId,
      backgroundUrl: input.backgroundUrl,
      backgroundPublicId: input.backgroundPublicId,
      maxAttempts: input.maxAttempts,
      isOfficial: input.isOfficial,
      ownerId: input.ownerId,
      visibility: input.visibility,
    }).returning({ id: games.id })

    await tx.insert(attributes).values(input.attributes.map((a, i) => ({
      gameId: game!.id,
      key: a.key,
      label: a.label,
      type: a.type,
      sortOrder: i,
      orderValues: a.order ?? null,
      groups: a.groups ?? null,
    })))

    await tx.insert(characters).values(input.characters.map((c) => ({
      gameId: game!.id,
      name: c.name,
      imageUrl: c.imageUrl,
      imagePublicId: c.imagePublicId,
      attributes: c.attributes,
    })))
  })

  return { slug }
}

/** Ne supprime rien si `ownerId` n'est pas le propriétaire — évite un contrôle séparé. */
export async function deleteGame(gameId: number, ownerId: number): Promise<boolean> {
  const deleted = await db.delete(games)
    .where(and(eq(games.id, gameId), eq(games.ownerId, ownerId)))
    .returning({ id: games.id })
  return deleted.length > 0
}

export interface UpdateGameMetaInput {
  name: string
  maxAttempts: number
  iconUrl: string | null
  iconPublicId: string | null
  backgroundUrl: string | null
  backgroundPublicId: string | null
}

export async function updateGameMeta(gameId: number, input: UpdateGameMetaInput): Promise<void> {
  await db.update(games)
    .set({
      name: input.name,
      maxAttempts: input.maxAttempts,
      iconUrl: input.iconUrl,
      iconPublicId: input.iconPublicId,
      backgroundUrl: input.backgroundUrl,
      backgroundPublicId: input.backgroundPublicId,
      updatedAt: new Date(),
    })
    .where(eq(games.id, gameId))
}

export async function findGameDetailBySlug(slug: string): Promise<GameDetail | null> {
  const game = await db.query.games.findFirst({
    where: eq(games.slug, slug),
    with: {
      attributes: { orderBy: asc(attributes.sortOrder) },
      characters: { limit: 8 },
    },
  })
  if (!game) return null

  const characterCountRow = await db.query.characters.findMany({
    where: eq(characters.gameId, game.id),
    columns: { id: true },
  })

  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    iconUrl: game.iconUrl,
    backgroundUrl: game.backgroundUrl,
    maxAttempts: game.maxAttempts,
    characterCount: characterCountRow.length,
    attributeCount: game.attributes.length,
    attributes: game.attributes.map((a) => ({
      id: a.id,
      key: a.key,
      label: a.label,
      type: a.type,
      order: a.orderValues ?? undefined,
      // `?? undefined` ne suffit pas : un attribut sauvegardé sans indice
      // depuis l'admin stocke `[]` (pas NULL), et [] est "truthy" — sans ce
      // test de longueur, l'UI de jeu choisirait ce tableau vide plutôt que
      // de retomber sur `order` pour un attribut "ordonné" (indices absents
      // en jeu alors que les valeurs existent).
      hints: a.hints?.length ? a.hints : undefined,
      groups: a.groups?.length ? a.groups : undefined,
    })),
    characterPreview: game.characters.map((c) => ({ id: c.id, name: c.name, imageUrl: c.imageUrl })),
  }
}

export async function findGamePlayDataBySlug(slug: string): Promise<GamePlayData | null> {
  const game = await db.query.games.findFirst({
    where: eq(games.slug, slug),
    with: {
      attributes: { orderBy: asc(attributes.sortOrder) },
      // Sans tri explicite, Postgres ne garantit pas un ordre stable — un
      // UPDATE (voir édition admin) peut faire "sauter" un personnage dans
      // la liste sans ça, ce qui a l'air d'une perte de données côté UI.
      characters: { orderBy: asc(characters.id) },
    },
  })
  if (!game) return null

  return {
    id: game.id,
    slug: game.slug,
    name: game.name,
    backgroundUrl: game.backgroundUrl,
    maxAttempts: game.maxAttempts,
    attributes: game.attributes.map((a) => ({
      id: a.id,
      key: a.key,
      label: a.label,
      type: a.type,
      order: a.orderValues ?? undefined,
      // Voir le commentaire équivalent dans findGameDetailBySlug.
      hints: a.hints?.length ? a.hints : undefined,
      groups: a.groups?.length ? a.groups : undefined,
    })),
    characters: game.characters.map((c) => ({
      id: c.id,
      name: c.name,
      imageUrl: c.imageUrl,
      attributes: c.attributes,
    })),
  }
}

export interface AdminGameSummary {
  slug: string
  name: string
  isOfficial: boolean
  characterCount: number
}

// Contrairement à listPublicGames, aucun filtre de visibilité — un admin
// doit pouvoir retrouver n'importe quel jeu pour en éditer les personnages.
export async function listAllGames(): Promise<AdminGameSummary[]> {
  const rows = await db.query.games.findMany({
    orderBy: asc(games.name),
    with: { characters: { columns: { id: true } } },
  })
  return rows.map((g) => ({
    slug: g.slug,
    name: g.name,
    isOfficial: g.isOfficial,
    characterCount: g.characters.length,
  }))
}

export interface CharacterInput {
  name: string
  imageUrl: string
  imagePublicId: string | null
  attributes: Record<string, unknown>
}

export async function addCharacter(gameId: number, input: CharacterInput): Promise<{ id: number }> {
  const [row] = await db.insert(characters).values({
    gameId,
    name: input.name,
    imageUrl: input.imageUrl,
    imagePublicId: input.imagePublicId,
    attributes: input.attributes,
  }).returning({ id: characters.id })
  return row!
}

/** Ne modifie rien si `characterId` n'appartient pas à `gameId` — évite un contrôle séparé. */
export async function updateCharacter(characterId: number, gameId: number, input: CharacterInput): Promise<boolean> {
  const updated = await db.update(characters)
    .set({
      name: input.name,
      imageUrl: input.imageUrl,
      imagePublicId: input.imagePublicId,
      attributes: input.attributes,
    })
    .where(and(eq(characters.id, characterId), eq(characters.gameId, gameId)))
    .returning({ id: characters.id })
  return updated.length > 0
}

export async function deleteCharacter(characterId: number, gameId: number): Promise<boolean> {
  const deleted = await db.delete(characters)
    .where(and(eq(characters.id, characterId), eq(characters.gameId, gameId)))
    .returning({ id: characters.id })
  return deleted.length > 0
}

function defaultAttributeValue(type: AttributeType): unknown {
  if (type === 'number') return 0
  if (type === 'boolean') return false
  if (type === 'multiple') return []
  return ''
}

export interface AttributeInput {
  key: string
  label: string
  type: AttributeType
  order?: string[] | null
  hints?: string[] | null
  groups?: string[][] | null
}

export async function listAttributeKeys(gameId: number): Promise<{ id: number; key: string }[]> {
  return db.query.attributes.findMany({
    where: eq(attributes.gameId, gameId),
    columns: { id: true, key: true },
  })
}

export async function addAttribute(gameId: number, input: AttributeInput): Promise<{ id: number }> {
  const [{ maxOrder }] = await db
    .select({ maxOrder: sql<number>`coalesce(max(${attributes.sortOrder}), -1)` })
    .from(attributes)
    .where(eq(attributes.gameId, gameId))

  const [row] = await db.insert(attributes).values({
    gameId,
    key: input.key,
    label: input.label,
    type: input.type,
    // Ajouté en dernière position — l'ordre d'affichage se réarrange
    // ensuite via reorderAttributes si besoin.
    sortOrder: (maxOrder ?? -1) + 1,
    orderValues: input.order ?? null,
    // null plutôt que [] quand c'est vide : un tableau vide est "truthy",
    // il casserait le repli vers `order` côté affichage des indices en jeu.
    hints: input.hints?.length ? input.hints : null,
    groups: input.groups?.length ? input.groups : null,
  }).returning({ id: attributes.id })

  // Les personnages existants n'ont pas cette clé dans leur JSONB tant
  // qu'on ne la leur ajoute pas explicitement — sans ça la valeur serait
  // "undefined" côté jeu au lieu d'une valeur vide cohérente avec le type.
  await db.execute(sql`
    update ${characters}
    set attributes = attributes || jsonb_build_object(${input.key}::text, ${JSON.stringify(defaultAttributeValue(input.type))}::jsonb)
    where ${characters.gameId} = ${gameId}
  `)

  return row!
}

export interface UpdateAttributeInput {
  label: string
  type: AttributeType
  order?: string[] | null
  hints?: string[] | null
  groups?: string[][] | null
}

export async function updateAttribute(attributeId: number, gameId: number, input: UpdateAttributeInput): Promise<boolean> {
  const updated = await db.update(attributes)
    .set({
      label: input.label,
      type: input.type,
      orderValues: input.order ?? null,
      hints: input.hints?.length ? input.hints : null,
      groups: input.groups?.length ? input.groups : null,
    })
    .where(and(eq(attributes.id, attributeId), eq(attributes.gameId, gameId)))
    .returning({ id: attributes.id })
  return updated.length > 0
}

/** Retire aussi la clé désormais orpheline du JSONB de chaque personnage. */
export async function deleteAttribute(attributeId: number, gameId: number): Promise<boolean> {
  const deleted = await db.delete(attributes)
    .where(and(eq(attributes.id, attributeId), eq(attributes.gameId, gameId)))
    .returning({ id: attributes.id, key: attributes.key })
  if (deleted.length === 0) return false

  await db.execute(sql`
    update ${characters}
    set attributes = attributes - ${deleted[0]!.key}::text
    where ${characters.gameId} = ${gameId}
  `)
  return true
}

export async function reorderAttributes(gameId: number, orderedIds: number[]): Promise<void> {
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(attributes)
        .set({ sortOrder: i })
        .where(and(eq(attributes.id, orderedIds[i]!), eq(attributes.gameId, gameId)))
    }
  })
}

// "ordered" exclu : une valeur hors de `order` est déjà rejetée à l'écriture
// (coerceAttributeValue), donc `order` contient forcément déjà tout ce qui
// est utilisé — pas de synchronisation à faire pour ce type.
const HINTABLE_TYPES: AttributeType[] = ['text', 'multiple', 'text-group']

function valuesForHints(type: AttributeType, raw: unknown): string[] {
  const list = type === 'multiple' ? (Array.isArray(raw) ? raw : []) : (raw !== undefined && raw !== null && raw !== '' ? [raw] : [])
  return [...new Set(list.map((v) => String(v).trim()).filter(Boolean))]
}

export interface SyncHintsResult {
  attributeKey: string
  attributeLabel: string
  addedValues: string[]
}

/**
 * Pour chaque attribut "texte"/"multiple"/"groupe" du jeu, ajoute aux
 * indices toute valeur déjà utilisée par un personnage mais absente de la
 * liste — et déduplique au passage les indices existants (filet de
 * sécurité contre une éventuelle entrée en double laissée par une écriture
 * concurrente via growAttributeHints ci-dessous).
 */
export async function syncAttributeHintsWithUsedValues(gameId: number): Promise<SyncHintsResult[]> {
  const gameAttributes = await db.query.attributes.findMany({ where: eq(attributes.gameId, gameId) })
  const gameCharacters = await db.query.characters.findMany({
    where: eq(characters.gameId, gameId),
    columns: { attributes: true },
  })

  const results: SyncHintsResult[] = []

  for (const attr of gameAttributes) {
    if (!HINTABLE_TYPES.includes(attr.type)) continue

    const seen = new Map<string, string>() // clé en minuscule -> casse d'origine (premier vu)
    for (const h of attr.hints ?? []) {
      const key = h.toLowerCase()
      if (!seen.has(key)) seen.set(key, h)
    }
    const beforeCount = seen.size

    const added = new Set<string>()
    for (const c of gameCharacters) {
      for (const v of valuesForHints(attr.type, c.attributes[attr.key])) {
        const key = v.toLowerCase()
        if (!seen.has(key)) {
          seen.set(key, v)
          added.add(v)
        }
      }
    }

    if (seen.size === beforeCount && added.size === 0) continue

    const addedValues = [...added].sort((a, b) => a.localeCompare(b))
    const dedupedExisting = [...new Map([...seen].filter(([k]) => !added.has(seen.get(k)!))).values()]
    const newHints = [...dedupedExisting, ...addedValues]

    await db.update(attributes).set({ hints: newHints }).where(eq(attributes.id, attr.id))
    results.push({ attributeKey: attr.key, attributeLabel: attr.label, addedValues })
  }

  return results
}

/**
 * Appelé après la sauvegarde d'un personnage : si une valeur saisie pour un
 * attribut "texte"/"multiple"/"groupe" n'est pas déjà dans ses indices,
 * l'y ajoute — pour que les indices restent à jour avec ce qui est
 * réellement jouable, sans synchronisation manuelle à chaque fois.
 */
export async function growAttributeHints(
  gameAttributes: { id: number; key: string; type: AttributeType }[],
  submittedValues: Record<string, unknown>,
): Promise<void> {
  for (const attr of gameAttributes) {
    if (!HINTABLE_TYPES.includes(attr.type)) continue
    const candidates = valuesForHints(attr.type, submittedValues[attr.key])
    if (candidates.length === 0) continue

    // Relu juste avant l'écriture (pas depuis un éventuel cache) pour
    // réduire la fenêtre de course avec un autre personnage sauvegardé en
    // parallèle (ex: "Tout enregistrer") qui ajouterait le même indice.
    const [current] = await db.select({ hints: attributes.hints }).from(attributes).where(eq(attributes.id, attr.id))
    const existingHints = current?.hints ?? []
    const existingLower = new Set(existingHints.map((h) => h.toLowerCase()))
    const newOnes = candidates.filter((v) => !existingLower.has(v.toLowerCase()))
    if (newOnes.length === 0) continue

    await db.update(attributes).set({ hints: [...existingHints, ...newOnes] }).where(eq(attributes.id, attr.id))
  }
}

export interface RenameRule {
  from: string
  /** null = retire juste `from` des indices, aucun personnage n'est modifié (utile pour un indice déjà orphelin). */
  to: string | null
}

export interface RenameValueResult {
  from: string
  to: string | null
  charactersUpdated: number
}

/**
 * Fusionne/renomme en masse des valeurs d'un attribut texte/multiple/groupe à
 * travers tous les personnages du jeu (ex: "Beast Pirates" -> "Beasts
 * Pirates"), et met à jour les indices en conséquence (retire les valeurs
 * d'origine devenues inutilisées, ajoute les valeurs cibles si absentes).
 * Pensé pour nettoyer en un clic les doublons/fautes de frappe accumulés
 * dans la donnée brute des personnages, sans accès direct à la prod.
 */
export async function renameAttributeValues(
  gameId: number,
  attributeId: number,
  rules: RenameRule[],
): Promise<RenameValueResult[]> {
  const attr = await db.query.attributes.findFirst({ where: and(eq(attributes.id, attributeId), eq(attributes.gameId, gameId)) })
  if (!attr || !HINTABLE_TYPES.includes(attr.type)) throw createError({ statusCode: 404, message: 'Attribut introuvable ou type non pris en charge' })

  const gameCharacters = await db.query.characters.findMany({
    where: eq(characters.gameId, gameId),
    columns: { id: true, attributes: true },
  })

  const ruleFor = (raw: unknown): RenameRule | undefined => {
    if (typeof raw !== 'string') return undefined
    const norm = raw.trim().toLowerCase()
    return rules.find((r) => r.from.trim().toLowerCase() === norm)
  }

  const counts = new Map<RenameRule, number>(rules.map((r) => [r, 0]))

  await db.transaction(async (tx) => {
    for (const c of gameCharacters) {
      const current = c.attributes[attr.key]
      let next = current
      let changed = false

      if (attr.type === 'multiple') {
        const list = Array.isArray(current) ? current : []
        const mapped: string[] = []
        for (const v of list) {
          const rule = ruleFor(v)
          if (rule && rule.to !== null) {
            counts.set(rule, (counts.get(rule) ?? 0) + 1)
            changed = true
            if (!mapped.some((m) => m.toLowerCase() === rule.to!.toLowerCase())) mapped.push(rule.to)
          } else {
            if (!mapped.some((m) => m.toLowerCase() === String(v).toLowerCase())) mapped.push(v as string)
          }
        }
        if (changed) next = mapped
      } else {
        const rule = ruleFor(current)
        if (rule && rule.to !== null) {
          counts.set(rule, (counts.get(rule) ?? 0) + 1)
          changed = true
          next = rule.to
        }
      }

      if (changed) {
        await tx.update(characters).set({ attributes: { ...c.attributes, [attr.key]: next } }).where(eq(characters.id, c.id))
      }
    }

    const fromKeys = new Set(rules.map((r) => r.from.trim().toLowerCase()))
    const toValues = [...new Set(rules.filter((r) => r.to !== null).map((r) => r.to as string))]
    let hints = (attr.hints ?? []).filter((h) => !fromKeys.has(h.trim().toLowerCase()))
    const hintsLower = new Set(hints.map((h) => h.toLowerCase()))
    for (const v of toValues) {
      if (!hintsLower.has(v.toLowerCase())) {
        hints.push(v)
        hintsLower.add(v.toLowerCase())
      }
    }
    await tx.update(attributes).set({ hints }).where(eq(attributes.id, attr.id))
  })

  return rules.map((r) => ({ from: r.from, to: r.to, charactersUpdated: counts.get(r) ?? 0 }))
}
