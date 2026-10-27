import { z } from 'zod'
import { requireAdmin } from '~~/server/utils/admin'
import { readValidatedQuery } from '~~/server/utils/validate'
import { searchAnilistMedia } from '~~/server/utils/anilist'

const schema = z.object({
  q: z.string().trim().min(1, 'Tape un titre à chercher').max(100),
  type: z.enum(['ANIME', 'MANGA']).default('ANIME'),
})

export default defineEventHandler(async (event) => {
  await requireAdmin(event)
  const { q, type } = readValidatedQuery(event, schema)
  return searchAnilistMedia(q, type)
})
