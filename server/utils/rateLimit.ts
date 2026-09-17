import type { H3Event } from 'h3'

interface Bucket {
  count: number
  resetAt: number
}

// Mono-instance (un seul process Node) : un Map en mémoire suffit, pas
// besoin de Redis pour ça tant qu'il n'y a qu'une seule instance de l'app.
const buckets = new Map<string, Bucket>()

// Purge périodique pour ne pas accumuler indéfiniment des entrées expirées.
setInterval(() => {
  const now = Date.now()
  for (const [key, bucket] of buckets) {
    if (bucket.resetAt < now) buckets.delete(key)
  }
}, 5 * 60 * 1000).unref()

/**
 * Limite le nombre d'appels par IP+scope sur une fenêtre glissante.
 * Lève une 429 si dépassé.
 */
export function rateLimit(event: H3Event, scope: string, max: number, windowMs: number) {
  const ip = getRequestIP(event, { xForwardedFor: true }) ?? 'unknown'
  const key = `${scope}:${ip}`
  const now = Date.now()

  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt < now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return
  }

  bucket.count++
  if (bucket.count > max) {
    throw createError({ statusCode: 429, message: 'Trop de tentatives, réessaie plus tard' })
  }
}
