import type { ZodType } from 'zod'
import type { H3Event } from 'h3'

/** Lit et valide le body JSON contre un schéma Zod ; lève une 400 sinon. */
export async function readValidatedJsonBody<T>(event: H3Event, schema: ZodType<T>): Promise<T> {
  const body = await readBody(event)
  const result = schema.safeParse(body)
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Validation échouée'
    throw createError({ statusCode: 400, message: firstError })
  }
  return result.data
}

/** Même chose pour les paramètres de query string (?foo=bar). */
export function readValidatedQuery<T>(event: H3Event, schema: ZodType<T>): T {
  const result = schema.safeParse(getQuery(event))
  if (!result.success) {
    const firstError = result.error.issues[0]?.message ?? 'Validation échouée'
    throw createError({ statusCode: 400, message: firstError })
  }
  return result.data
}
