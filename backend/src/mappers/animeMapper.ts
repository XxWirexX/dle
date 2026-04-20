type AnimeData = Record<string, unknown>;

export function toListItem(anime: AnimeData) {
  return {
    id: anime.id,
    name: anime.name,
    icon: anime.icon,
    background: anime.background,
    maxAttempts: anime.maxAttempts,
    characterCount: ((anime.characters as unknown[]) || []).length,
    attributeCount: ((anime.attributes as unknown[]) || []).length,
  };
}

export function toDetail(anime: AnimeData) {
  return {
    id: anime.id,
    name: anime.name,
    icon: anime.icon,
    background: anime.background,
    maxAttempts: anime.maxAttempts,
    attributes: anime.attributes || [],
    characterCount: ((anime.characters as unknown[]) || []).length,
    characters: ((anime.characters as AnimeData[]) || []).slice(0, 8).map(toSlimChar),
  };
}

export function toGame(anime: AnimeData) {
  return {
    id: anime.id,
    name: anime.name,
    background: anime.background,
    maxAttempts: anime.maxAttempts,
    attributes: anime.attributes || [],
    characters: anime.characters || [],
  };
}

export function toAvatarGroup(anime: AnimeData) {
  return {
    animeId: anime.id,
    animeName: anime.name,
    characters: ((anime.characters as AnimeData[]) || []).slice(0, 10).map(toSlimChar),
  };
}

function toSlimChar(c: AnimeData) {
  return { id: c.id, name: c.name, image: c.image };
}
