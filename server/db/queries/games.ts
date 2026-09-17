import { eq, asc } from 'drizzle-orm'
import { db } from '../client'
import { games, attributes, characters } from '../schema'
import type { GameSummary, GameDetail, GamePlayData } from '#shared/types/game'

export async function listOfficialGames(): Promise<GameSummary[]> {
  const rows = await db.query.games.findMany({
    where: eq(games.isOfficial, true),
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
      characters: true,
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
