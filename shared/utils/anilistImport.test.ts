import { describe, it, expect } from 'vitest'
import {
  parseDescriptionFields,
  parseLeadingNumber,
  normalizeCharacterEdge,
  detectFields,
  filterCharacters,
  buildImportedCharacters,
  readFieldValue,
  DEFAULT_IMPORT_FILTERS,
  type AnilistCharacter,
} from './anilistImport'

function character(overrides: Partial<AnilistCharacter> = {}): AnilistCharacter {
  return {
    anilistId: 1,
    name: 'Monkey D. Luffy',
    nativeName: null,
    imageUrl: 'https://s4.anilist.co/file/anilistcdn/character/large/b40.png',
    role: 'MAIN',
    favourites: 1000,
    gender: 'Male',
    age: '17',
    birthMonth: 5,
    bloodType: 'F',
    descriptionFields: {},
    ...overrides,
  }
}

describe('parseDescriptionFields', () => {
  it('lit les lignes "__Clé:__ valeur" et ignore le texte libre', () => {
    const desc = '__Height:__ 174 cm (5\'8.5")\n__Affiliation:__ Straw Hat Pirates\n\nMonkey D. Luffy is the captain.'
    expect(parseDescriptionFields(desc)).toEqual({
      Height: '174 cm (5\'8.5")',
      Affiliation: 'Straw Hat Pirates',
    })
  })

  it('accepte le deux-points hors du gras et la syntaxe **', () => {
    expect(parseDescriptionFields('__Occupation__: Pirate\n**Bounty:** 3,000,000,000')).toEqual({
      Occupation: 'Pirate',
      Bounty: '3,000,000,000',
    })
  })

  it('retire les marqueurs de spoiler et les liens', () => {
    const desc = '~!__Devil Fruit:__ [Hito Hito no Mi](https://anilist.co/x)!~'
    expect(parseDescriptionFields(desc)).toEqual({ 'Devil Fruit': 'Hito Hito no Mi' })
  })

  it('gère les <br> et ignore une ligne en gras sans deux-points', () => {
    expect(parseDescriptionFields('__Note__ texte libre<br>__Rank:__ Captain')).toEqual({ Rank: 'Captain' })
  })

  it('renvoie un objet vide sans description', () => {
    expect(parseDescriptionFields(null)).toEqual({})
    expect(parseDescriptionFields('Juste une phrase.')).toEqual({})
  })
})

describe('parseLeadingNumber', () => {
  it('lit le premier nombre', () => {
    expect(parseLeadingNumber('174 cm')).toBe(174)
    expect(parseLeadingNumber('17 (pre-timeskip), 19')).toBe(17)
    expect(parseLeadingNumber('1.75 m')).toBe(1.75)
  })

  it('comprend les séparateurs de milliers', () => {
    expect(parseLeadingNumber('3,000,000,000')).toBe(3000000000)
    expect(parseLeadingNumber('12 000 000 Berry')).toBe(12000000)
  })

  it('renvoie null sans nombre en tête', () => {
    expect(parseLeadingNumber('Unknown')).toBeNull()
    expect(parseLeadingNumber('')).toBeNull()
    expect(parseLeadingNumber(null)).toBeNull()
  })
})

describe('normalizeCharacterEdge', () => {
  it('normalise un perso et écarte l\'image par défaut', () => {
    const result = normalizeCharacterEdge({
      role: 'SUPPORTING',
      node: {
        id: 42,
        name: { full: ' Nami ', native: 'ナミ' },
        image: { large: 'https://s4.anilist.co/file/anilistcdn/character/large/default.jpg' },
        favourites: 500,
        gender: 'Female',
        age: '18',
        bloodType: 'X',
        dateOfBirth: { month: 7 },
        description: '__Height:__ 169 cm',
      },
    })
    expect(result).toMatchObject({
      anilistId: 42,
      name: 'Nami',
      nativeName: 'ナミ',
      imageUrl: null,
      role: 'SUPPORTING',
      birthMonth: 7,
      descriptionFields: { Height: '169 cm' },
    })
  })

  it('ignore une arête sans nom et range un rôle inconnu en figurant', () => {
    expect(normalizeCharacterEdge({ role: 'MAIN', node: { id: 1, name: { full: '' } } })).toBeNull()
    expect(normalizeCharacterEdge({ role: null, node: { id: 2, name: { full: 'X' } } })?.role).toBe('BACKGROUND')
  })
})

describe('detectFields', () => {
  const chars = [
    character({ descriptionFields: { Height: '174 cm', Affiliation: 'Straw Hat Pirates' } }),
    character({ anilistId: 2, name: 'Zoro', descriptionFields: { height: '181 cm', Affiliation: 'Straw Hat Pirates' } }),
    character({ anilistId: 3, name: 'Coby', gender: null, age: null, descriptionFields: { Height: '167 cm', Rank: 'Captain' } }),
  ]
  const fields = detectFields(chars)
  const byId = Object.fromEntries(fields.map((f) => [f.id, f]))

  it('calcule le taux de remplissage des champs AniList', () => {
    expect(byId.gender!.coverage).toBeCloseTo(2 / 3)
    expect(byId.gender!.samples).toEqual(['Homme'])
    expect(byId.gender!.selectedByDefault).toBe(true)
  })

  it('regroupe les clés de description sans tenir compte de la casse', () => {
    expect(byId['desc:height']).toMatchObject({ label: 'Height', type: 'number', coverage: 1, selectedByDefault: true })
    expect(byId['desc:affiliation']!.type).toBe('text')
  })

  it('écarte une clé vue sur un seul perso', () => {
    expect(byId['desc:rank']).toBeUndefined()
  })

  it('ne coche pas par défaut un champ peu rempli', () => {
    const sparse = detectFields([character(), character({ anilistId: 2, gender: null }), character({ anilistId: 3, gender: null })])
    expect(sparse.find((f) => f.id === 'gender')!.selectedByDefault).toBe(false)
  })
})

describe('filterCharacters + buildImportedCharacters', () => {
  const chars = [
    character(),
    character({ anilistId: 2, name: 'Figurant', role: 'BACKGROUND', favourites: 0 }),
    character({ anilistId: 3, name: 'Sans image', imageUrl: null }),
    character({ anilistId: 4, name: 'Peu connu', favourites: 3 }),
  ]

  it('applique les filtres par défaut', () => {
    expect(filterCharacters(chars, DEFAULT_IMPORT_FILTERS).map((c) => c.anilistId)).toEqual([1, 4])
  })

  it('filtre sur un seuil de favoris', () => {
    expect(filterCharacters(chars, { ...DEFAULT_IMPORT_FILTERS, minFavourites: 10 }).map((c) => c.anilistId)).toEqual([1])
  })

  it('remplit les valeurs des champs choisis', () => {
    const [luffy] = buildImportedCharacters(
      [character({ descriptionFields: { Height: '174 cm' } })],
      [
        { id: 'gender', label: 'Genre', type: 'text' },
        { id: 'age', label: 'Âge', type: 'number' },
        { id: 'desc:height', label: 'Taille', type: 'number' },
        { id: 'desc:bounty', label: 'Prime', type: 'text' },
      ],
    )
    expect(luffy).toEqual({
      name: 'Monkey D. Luffy',
      imageUrl: chars[0]!.imageUrl,
      values: { gender: 'Homme', age: 17, 'desc:height': 174, 'desc:bounty': null },
    })
  })

  it('respecte le type choisi par l\'admin', () => {
    const c = character({ descriptionFields: { Height: '174 cm' } })
    expect(readFieldValue({ id: 'desc:height', type: 'text' }, c)).toBe('174 cm')
    expect(readFieldValue({ id: 'favourites', type: 'text' }, c)).toBe('1000')
  })
})
