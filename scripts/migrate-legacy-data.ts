/**
 * Migration unique : lit l'ancien contenu (legacy-content/anime-data/*.json
 * + legacy-content/anime-images/) et le bascule vers la nouvelle structure
 * (Postgres + Cloudinary). Ne fait pas partie du runtime de l'app — se
 * lance à la main (`npm run migrate:legacy`) une fois `.env` renseigné.
 *
 * `MIGRATE_DRY_RUN=1` saute l'upload Cloudinary (utile pour vérifier la
 * partie DB sans compte Cloudinary configuré, ou en dev).
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { v2 as cloudinary } from 'cloudinary'
import { eq } from 'drizzle-orm'
import * as schema from '../server/db/schema'
import type { AttributeType } from '#shared/types/game'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../legacy-content/anime-data')
const IMAGES_DIR = path.join(__dirname, '../legacy-content/anime-images')
const DRY_RUN = process.env.MIGRATE_DRY_RUN === '1'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquant — copie .env.example vers .env et renseigne-le.')
}
if (!DRY_RUN && !process.env.CLOUDINARY_CLOUD_NAME) {
  throw new Error('CLOUDINARY_CLOUD_NAME manquant — configure Cloudinary ou lance avec MIGRATE_DRY_RUN=1.')
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
  secure: true,
})

const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const db = drizzle(sql, { schema })

interface LegacyAttribute {
  key: string
  label: string
  // Absent sur au moins une entrée historique (voir normalizeType).
  type?: string
  order?: string[]
  hints?: string[]
  groups?: string[][]
}

interface LegacyCharacter {
  id: number | string
  name: string
  image: string
  [key: string]: unknown
}

interface LegacyGame {
  id: string
  name: string
  icon: string
  background: string
  maxAttempts: number
  attributes: LegacyAttribute[]
  characters: LegacyCharacter[]
}

const VALID_TYPES: AttributeType[] = ['text', 'number', 'ordered', 'multiple', 'text-group', 'boolean']

// Les seuls types réellement modélisés côté DB. "multi" est un synonyme
// hérité de "multiple". Certaines entrées (star-wars.json/"appearance")
// n'ont pas de `type` du tout et utilisaient à la place `partialMatch:
// true` — dans le moteur d'origine, une entrée sans `type` reconnu tombe
// systématiquement dans le comparateur "text" par défaut (correspondance
// par sous-chaîne), donc "partial match" == type "text", pas un type à part.
function normalizeType(type: string | undefined): AttributeType {
  if (type === 'multi') return 'multiple'
  if (type && VALID_TYPES.includes(type as AttributeType)) return type as AttributeType
  return 'text'
}

async function uploadImage(localPath: string, publicId: string): Promise<{ url: string; publicId: string | null }> {
  if (DRY_RUN) {
    return { url: `local-dry-run://${path.relative(IMAGES_DIR, localPath)}`, publicId: null }
  }
  const result = await cloudinary.uploader.upload(localPath, {
    public_id: publicId,
    overwrite: true,
    folder: undefined, // public_id porte déjà le chemin complet
  })
  return { url: result.secure_url, publicId: result.public_id }
}

function findLocalImage(gameSlug: string, subdir: string, filename: string): string | null {
  const p = path.join(IMAGES_DIR, gameSlug, subdir, filename)
  return fs.existsSync(p) ? p : null
}

async function migrateGame(file: string) {
  const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf-8')
  const data: LegacyGame = JSON.parse(raw)
  const slug = data.id

  console.log(`\n→ ${slug} (${data.characters.length} personnages, ${data.attributes.length} attributs)`)

  const iconPath = path.join(IMAGES_DIR, slug, data.icon)
  const backgroundPath = path.join(IMAGES_DIR, slug, data.background)

  const icon = fs.existsSync(iconPath)
    ? await uploadImage(iconPath, `dle/games/${slug}/icon`)
    : null
  const background = fs.existsSync(backgroundPath)
    ? await uploadImage(backgroundPath, `dle/games/${slug}/background`)
    : null

  const [game] = await db.insert(schema.games).values({
    slug,
    name: data.name,
    iconUrl: icon?.url ?? null,
    iconPublicId: icon?.publicId ?? null,
    backgroundUrl: background?.url ?? null,
    backgroundPublicId: background?.publicId ?? null,
    maxAttempts: data.maxAttempts,
    isOfficial: true,
  }).onConflictDoUpdate({
    target: schema.games.slug,
    set: {
      name: data.name,
      iconUrl: icon?.url ?? null,
      iconPublicId: icon?.publicId ?? null,
      backgroundUrl: background?.url ?? null,
      backgroundPublicId: background?.publicId ?? null,
      maxAttempts: data.maxAttempts,
      updatedAt: new Date(),
    },
  }).returning()

  const gameId = game!.id

  // Resync complet des enfants à chaque run : script de migration, pas de
  // logique d'edit incrémentale à préserver.
  await db.delete(schema.attributes).where(eq(schema.attributes.gameId, gameId))
  await db.delete(schema.characters).where(eq(schema.characters.gameId, gameId))

  if (data.attributes.length > 0) {
    await db.insert(schema.attributes).values(data.attributes.map((attr, i) => ({
      gameId,
      key: attr.key,
      label: attr.label,
      type: normalizeType(attr.type),
      sortOrder: i,
      orderValues: attr.order ?? null,
      hints: attr.hints ?? null,
      groups: attr.groups ?? null,
    })))
  }

  let uploaded = 0
  for (const char of data.characters) {
    const localImage = findLocalImage(slug, 'characters', char.image)
    const image = localImage
      ? await uploadImage(localImage, `dle/games/${slug}/characters/${char.id}`)
      : { url: '', publicId: null }

    if (localImage) uploaded++

    const { id, name, image: _img, ...attributeValues } = char

    await db.insert(schema.characters).values({
      gameId,
      name,
      imageUrl: image.url,
      imagePublicId: image.publicId,
      attributes: attributeValues,
    })
  }

  console.log(`  ✓ ${data.characters.length} personnages migrés (${uploaded} images trouvées localement)`)
  return { slug, expectedCharacters: data.characters.length }
}

async function main() {
  console.log(DRY_RUN ? '[DRY RUN] Pas d\'upload Cloudinary — DB uniquement.' : 'Migration complète (DB + Cloudinary).')

  const files = fs.readdirSync(DATA_DIR).filter((f) => f.endsWith('.json'))
  const results = []
  for (const file of files) {
    results.push(await migrateGame(file))
  }

  console.log(`\n${results.length} jeux migrés.`)
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
