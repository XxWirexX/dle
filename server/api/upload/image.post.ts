import { requireAuthPayload } from '~~/server/utils/session'
import { uploadUserImage } from '~~/server/utils/upload'

const MAX_SIZE_BYTES = 5 * 1024 * 1024

const MAX_DIMENSION: Record<string, number> = {
  icon: 400,
  background: 1920,
  character: 320,
}

// Utilisé par le formulaire de création de DLE custom (icône, fond,
// portraits de personnage) : un seul endpoint générique plutôt qu'un par
// usage, la seule différence entre eux étant la résolution cible.
export default defineEventHandler(async (event) => {
  const { userId } = requireAuthPayload(event)

  const parts = await readMultipartFormData(event)
  if (!parts) throw createError({ statusCode: 400, message: 'Requête invalide' })

  const filePart = parts.find((p) => p.name === 'image')
  if (!filePart?.data?.length) throw createError({ statusCode: 400, message: 'Image manquante' })
  if (filePart.data.length > MAX_SIZE_BYTES) throw createError({ statusCode: 400, message: 'Image trop lourde (5 Mo max)' })
  if (filePart.type && !filePart.type.startsWith('image/')) {
    throw createError({ statusCode: 400, message: 'Le fichier doit être une image' })
  }

  const kindRaw = parts.find((p) => p.name === 'kind')?.data.toString('utf-8')
  const kind = kindRaw && kindRaw in MAX_DIMENSION ? kindRaw : 'character'

  const config = useRuntimeConfig(event).cloudinary
  return uploadUserImage(filePart.data, `dle/custom/${kind}/${userId}`, MAX_DIMENSION[kind]!, config)
})
