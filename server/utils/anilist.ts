import {
  normalizeCharacterEdge,
  type AnilistCharacter,
  type AnilistMediaCharacters,
  type AnilistMediaSummary,
  type AnilistMediaType,
  type RawCharacterEdge,
} from '#shared/utils/anilistImport'

// Client de l'API GraphQL publique d'AniList (sans clé). Appelé uniquement
// depuis les routes admin d'import : jamais pendant une partie, les données
// sont copiées dans notre base à la création du jeu.

const ENDPOINT = 'https://graphql.anilist.co'
const PER_PAGE = 25
// Garde-fou : 80 pages = 2000 persos, au-delà c'est forcément une erreur
const MAX_PAGES = 80
// Pause entre deux pages pour rester sous la limite de requêtes d'AniList
const PAGE_DELAY_MS = 700
const MAX_RETRIES = 3

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

interface GraphQLResponse<T> {
  data?: T
  errors?: { message: string, status?: number }[]
}

async function anilistRequest<T>(query: string, variables: Record<string, unknown>): Promise<T> {
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query, variables }),
        signal: AbortSignal.timeout(20_000),
      })
    } catch {
      throw createError({ statusCode: 502, message: 'AniList ne répond pas, réessaie dans un instant' })
    }

    // Limite de requêtes : AniList indique combien de secondes attendre
    if (res.status === 429 && attempt < MAX_RETRIES) {
      const retryAfter = Number(res.headers.get('Retry-After'))
      await sleep(Math.min(Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : 30, 65) * 1000)
      continue
    }

    const body = await res.json().catch(() => null) as GraphQLResponse<T> | null
    if (res.status === 404) throw createError({ statusCode: 404, message: 'Introuvable sur AniList' })
    if (!res.ok || !body?.data) {
      const detail = body?.errors?.[0]?.message
      throw createError({ statusCode: 502, message: `Erreur AniList${detail ? ` : ${detail}` : ` (${res.status})`}` })
    }
    return body.data
  }
}

// ─── Recherche ───

const SEARCH_QUERY = `
query ($search: String, $type: MediaType) {
  Page(perPage: 10) {
    media(search: $search, type: $type, sort: [SEARCH_MATCH, POPULARITY_DESC]) {
      id
      title { romaji english }
      format
      seasonYear
      startDate { year }
      coverImage { large }
    }
  }
}`

interface RawMedia {
  id: number
  title: { romaji: string | null, english: string | null }
  format: string | null
  seasonYear?: number | null
  startDate?: { year: number | null } | null
  coverImage: { large: string | null } | null
}

function toMediaSummary(m: RawMedia): AnilistMediaSummary {
  const title = m.title.romaji || m.title.english || `#${m.id}`
  const english = m.title.english && m.title.english !== title ? m.title.english : null
  return {
    id: m.id,
    title,
    altTitle: english,
    format: m.format,
    year: m.seasonYear ?? m.startDate?.year ?? null,
    coverUrl: m.coverImage?.large ?? null,
  }
}

export async function searchAnilistMedia(search: string, type: AnilistMediaType): Promise<AnilistMediaSummary[]> {
  const data = await anilistRequest<{ Page: { media: RawMedia[] } }>(SEARCH_QUERY, { search, type })
  return data.Page.media.map(toMediaSummary)
}

// ─── Persos d'une œuvre ───

const CHARACTERS_QUERY = `
query ($id: Int, $page: Int, $perPage: Int) {
  Media(id: $id) {
    id
    title { romaji english }
    format
    seasonYear
    startDate { year }
    coverImage { large }
    characters(page: $page, perPage: $perPage, sort: [ROLE, FAVOURITES_DESC, ID]) {
      pageInfo { hasNextPage }
      edges {
        role
        node {
          id
          name { full native }
          image { large }
          favourites
          gender
          age
          bloodType
          dateOfBirth { month }
          description(asHtml: false)
        }
      }
    }
  }
}`

interface RawMediaWithCharacters extends RawMedia {
  characters: { pageInfo: { hasNextPage: boolean }, edges: RawCharacterEdge[] }
}

// Une longue série = plusieurs dizaines d'appels : on garde le résultat un
// moment pour qu'un admin qui revient en arrière ne relance pas tout.
const CACHE_TTL_MS = 30 * 60 * 1000
const CACHE_MAX_ENTRIES = 20
const cache = new Map<number, { expiresAt: number, value: AnilistMediaCharacters }>()
// Deux admins (ou deux onglets) sur la même œuvre partagent le même import
const inFlight = new Map<number, Promise<AnilistMediaCharacters>>()

async function fetchAllCharacters(mediaId: number): Promise<AnilistMediaCharacters> {
  const seen = new Set<number>()
  const characters: AnilistCharacter[] = []
  let media: AnilistMediaSummary | null = null

  for (let page = 1; page <= MAX_PAGES; page++) {
    if (page > 1) await sleep(PAGE_DELAY_MS)
    const data = await anilistRequest<{ Media: RawMediaWithCharacters | null }>(
      CHARACTERS_QUERY,
      { id: mediaId, page, perPage: PER_PAGE },
    )
    if (!data.Media) throw createError({ statusCode: 404, message: 'Œuvre introuvable sur AniList' })

    media ??= toMediaSummary(data.Media)
    for (const edge of data.Media.characters.edges) {
      const character = normalizeCharacterEdge(edge)
      if (!character || seen.has(character.anilistId)) continue
      seen.add(character.anilistId)
      characters.push(character)
    }
    if (!data.Media.characters.pageInfo.hasNextPage) break
  }

  return { media: media!, characters }
}

export async function getAnilistMediaCharacters(mediaId: number): Promise<AnilistMediaCharacters> {
  const cached = cache.get(mediaId)
  if (cached && cached.expiresAt > Date.now()) return cached.value

  const pending = inFlight.get(mediaId)
  if (pending) return pending

  const promise = fetchAllCharacters(mediaId)
    .then((value) => {
      cache.delete(mediaId)
      cache.set(mediaId, { expiresAt: Date.now() + CACHE_TTL_MS, value })
      while (cache.size > CACHE_MAX_ENTRIES) cache.delete(cache.keys().next().value!)
      return value
    })
    .finally(() => inFlight.delete(mediaId))

  inFlight.set(mediaId, promise)
  return promise
}
