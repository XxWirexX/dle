import { drizzle } from 'drizzle-orm/postgres-js'
import postgres from 'postgres'
import * as schema from './schema'

const config = useRuntimeConfig()

const queryClient = postgres(config.databaseUrl, {
  // Pool modeste : app mono-instance sur un seul VPS, pas besoin de
  // dimensionner pour du multi-instance.
  max: 10,
})

export const db = drizzle(queryClient, { schema })
