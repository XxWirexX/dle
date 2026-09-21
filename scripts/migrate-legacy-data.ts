/**
 * Migration unique : lit l'ancien contenu (legacy-content/anime-data/*.json
 * + legacy-content/anime-images/) et le bascule vers la nouvelle structure
 * (Postgres + Cloudinary). Ne fait pas partie du runtime de l'app — se
 * lance à la main (`npm run migrate:legacy`) une fois `.env` renseigné.
 *
 * `MIGRATE_DRY_RUN=1` saute l'upload Cloudinary (utile pour vérifier la
 * partie DB sans compte Cloudinary configuré, ou en dev).
 *
 * Idempotent : un jeu dont le nombre de personnages en DB correspond au JSON
 * est considéré comme déjà migré et sauté. Relancer le script reprend là où
 * ça s'est arrêté.
 */
import 'dotenv/config'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import { v2 as cloudinary } from 'cloudinary'
import { eq, count } from 'drizzle-orm'
import sharp from 'sharp'
import * as schema from '../server/db/schema'
import type { AttributeType } from '#shared/types/game'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const DATA_DIR = path.join(__dirname, '../legacy-content/anime-data')
const IMAGES_DIR = path.join(__dirname, '../legacy-content/anime-images')
const DRY_RUN = process.env.MIGRATE_DRY_RUN === '1'
const CONCURRENCY = 4

// Résolutions max à l'upload, par usage réel dans l'app (voir uploadImage).
const MAX_DIMENSION_ICON = 400 // affichée jusqu'à 200px (app/pages/games/[slug]/index.vue)
const MAX_DIMENSION_BACKGROUND = 1920 // affichée jusqu'à 1600px, plein écran
const MAX_DIMENSION_CHARACTER = 320 // affichée jusqu'à 160px (portraits de résultat)

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

function normalizeType(type: string | undefined): AttributeType {
  if (type === 'multi') return 'multiple'
  if (type && VALID_TYPES.includes(type as AttributeType)) return type as AttributeType
  return 'text'
}

// Certains jeux legacy (star-wars notamment) stockent des valeurs de
// personnage sous forme de tableau pour un attribut déclaré (ou par défaut)
// "text" — le flag `partialMatch: true` de la v1 le signalait déjà, mais le
// moteur d'origine l'ignorait complètement et appliquait quand même sa
// correspondance par sous-chaîne sur `Array.toString()` (ex: "Clone
// Wars,Rebels" vs "The Phantom Menace,Clone Wars" ne matche pas alors que
// "Clone Wars" est un élément commun) — un vrai bug hérité, jamais un
// comportement voulu. On se base sur la vraie forme des données plutôt que
// sur le type déclaré : si un perso a un tableau pour cette clé, c'est du
// "multiple" (comparaison par intersection d'ensembles), point final.
function inferType(attr: LegacyAttribute, characters: LegacyCharacter[]): AttributeType {
  const hasArrayValue = characters.some((c) => Array.isArray(c[attr.key]))
  return hasArrayValue ? 'multiple' : normalizeType(attr.type)
}

async function withRetry<T>(fn: () => Promise<T>, label: string, retries = 3): Promise<T> {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      return await fn()
    }
    catch (err: unknown) {
      if (attempt === retries) throw err
      const delay = 1000 * 2 ** (attempt - 1)
      const msg = err instanceof Error ? err.message : String(err)
      console.warn(`    ⚠ ${label} — tentative ${attempt}/${retries} échouée (${msg}), retry dans ${delay}ms…`)
      await new Promise(r => setTimeout(r, delay))
    }
  }
  throw new Error('unreachable')
}

async function uploadImage(localPath: string, publicId: string, maxDimension: number): Promise<{ url: string; publicId: string | null }> {
  if (DRY_RUN) {
    return { url: `local-dry-run://${path.relative(IMAGES_DIR, localPath)}`, publicId: null }
  }

  // Redimensionne (sans jamais agrandir) et encode en webp pour réduire la
  // taille envoyée. `maxDimension` dépend de l'usage réel de l'image côté
  // app — les backgrounds s'affichent plein écran jusqu'à 1600px
  // (cloudinaryUrl(..., 1600)), donc un cap à 300px comme pour une vignette
  // de personnage les rendrait flous une fois réaffichés en grand.
  const buffer = await sharp(localPath)
    .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  const dataUri = `data:image/webp;base64,${buffer.toString('base64')}`

  const result = await withRetry(
    () => cloudinary.uploader.upload(dataUri, {
      public_id: publicId,
      overwrite: true,
      timeout: 60000,
    }),
    publicId,
  )

  return { url: result.secure_url, publicId: result.public_id }
}

/** Exécute `tasks` en parallèle avec au plus `concurrency` à la fois. */
async function pooled<T>(tasks: (() => Promise<T>)[], concurrency: number): Promise<T[]> {
  const results: T[] = new Array(tasks.length)
  let idx = 0
  async function worker() {
    while (idx < tasks.length) {
      const i = idx++
      results[i] = await tasks[i]!()
    }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, tasks.length) }, worker))
  return results
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

  // --- Reprise : vérifie si le jeu est déjà complètement migré en DB ---
  const existingGame = await db.query.games.findFirst({ where: eq(schema.games.slug, slug) })
  if (existingGame) {
    const [{ value: charCount }] = await db
      .select({ value: count() })
      .from(schema.characters)
      .where(eq(schema.characters.gameId, existingGame.id))

    if (Number(charCount) === data.characters.length) {
      console.log(`  ↩ déjà migré — skip`)
      return { slug, expectedCharacters: data.characters.length }
    }
    console.log(`  ↻ migration partielle détectée (${charCount}/${data.characters.length}) — reprise`)
  }

  // --- Upload icône + background ---
  const iconPath = path.join(IMAGES_DIR, slug, data.icon)
  const backgroundPath = path.join(IMAGES_DIR, slug, data.background)

  const icon = fs.existsSync(iconPath)
    ? await withRetry(() => uploadImage(iconPath, `dle/games/${slug}/icon`, MAX_DIMENSION_ICON), `${slug}/icon`)
    : null
  const background = fs.existsSync(backgroundPath)
    ? await withRetry(() => uploadImage(backgroundPath, `dle/games/${slug}/background`, MAX_DIMENSION_BACKGROUND), `${slug}/background`)
    : null

  // --- Upsert du jeu ---
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

  await db.delete(schema.attributes).where(eq(schema.attributes.gameId, gameId))
  await db.delete(schema.characters).where(eq(schema.characters.gameId, gameId))

  if (data.attributes.length > 0) {
    await db.insert(schema.attributes).values(data.attributes.map((attr, i) => ({
      gameId,
      key: attr.key,
      label: attr.label,
      type: inferType(attr, data.characters),
      sortOrder: i,
      orderValues: attr.order ?? null,
      hints: attr.hints ?? null,
      groups: attr.groups ?? null,
    })))
  }

  // --- Upload images personnages en parallèle (pool CONCURRENCY) ---
  let done = 0
  const charData = await pooled(
    data.characters.map((char) => async () => {
      const localImage = findLocalImage(slug, 'characters', char.image)
      const image = localImage
        ? await uploadImage(localImage, `dle/games/${slug}/characters/${char.id}`, MAX_DIMENSION_CHARACTER)
        : { url: '', publicId: null }
      const { id: _id, name, image: _img, ...attributeValues } = char
      done++
      if (done % 10 === 0 || done === data.characters.length) {
        process.stdout.write(`\r  uploading ${done}/${data.characters.length}`)
      }
      return { name, image, localImage, attributeValues }
    }),
    CONCURRENCY,
  )
  process.stdout.write('\n')

  const uploaded = charData.filter(c => c.localImage).length

  if (charData.length > 0) {
    await db.insert(schema.characters).values(
      charData.map(({ name, image, attributeValues }) => ({
        gameId,
        name,
        imageUrl: image.url,
        imagePublicId: image.publicId,
        attributes: attributeValues,
      })),
    )
  }

  console.log(`  ✓ ${data.characters.length} personnages migrés (${uploaded} images uploadées)`)
  return { slug, expectedCharacters: data.characters.length }
}

async function main() {
  console.log(DRY_RUN ? '[DRY RUN] Pas d\'upload Cloudinary — DB uniquement.' : 'Migration complète (DB + Cloudinary).')

  const files = fs.readdirSync(DATA_DIR).filter(f => f.endsWith('.json'))
  const results = []
  for (const file of files) {
    results.push(await migrateGame(file))
  }

  console.log(`\n${results.length} jeux traités.`)
  await sql.end()
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
