function toListItem(anime) {
  return {
    id: anime.id,
    name: anime.name,
    icon: anime.icon,
    background: anime.background,
    maxAttempts: anime.maxAttempts,
    characterCount: (anime.characters || []).length,
    attributeCount: (anime.attributes || []).length,
  };
}

function toDetail(anime) {
  return {
    id: anime.id,
    name: anime.name,
    icon: anime.icon,
    background: anime.background,
    maxAttempts: anime.maxAttempts,
    attributes: anime.attributes || [],
    characterCount: (anime.characters || []).length,
    characters: (anime.characters || []).slice(0, 8).map(toSlimChar),
  };
}

function toGame(anime) {
  return {
    id: anime.id,
    name: anime.name,
    background: anime.background,
    maxAttempts: anime.maxAttempts,
    attributes: anime.attributes || [],
    characters: anime.characters || [],
  };
}

function toAvatarGroup(anime) {
  return {
    animeId: anime.id,
    animeName: anime.name,
    characters: (anime.characters || []).slice(0, 10).map(toSlimChar),
  };
}

function toSlimChar(c) {
  return { id: c.id, name: c.name, image: c.image };
}

module.exports = { toListItem, toDetail, toGame, toAvatarGroup };
