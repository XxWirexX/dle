import 'dotenv/config'
import { drizzle } from 'drizzle-orm/postgres-js'
import { migrate } from 'drizzle-orm/postgres-js/migrator'
import postgres from 'postgres'

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL manquant — copie .env.example vers .env et renseigne-le.')
}

const sql = postgres(process.env.DATABASE_URL, { max: 1 })
const db = drizzle(sql)

await migrate(db, { migrationsFolder: './drizzle' })
console.log('Migrations appliquées.')

await sql.end()
