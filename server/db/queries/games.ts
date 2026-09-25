import { eq, and, or, desc, asc } from 'drizzle-orm'
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
      key: a.key,
      label: a.label,
      type: a.type,
      order: a.orderValues ?? undefined,
      hints: a.hints ?? undefined,
      groups: a.groups ?? undefined,
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
      key: a.key,
      label: a.label,
      type: a.type,
      order: a.orderValues ?? undefined,
      hints: a.hints ?? undefined,
      groups: a.groups ?? undefined,
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
