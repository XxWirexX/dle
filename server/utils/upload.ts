import { v2 as cloudinary } from 'cloudinary'
import sharp from 'sharp'

export interface CloudinaryConfig {
  cloudName?: string
  apiKey?: string
  apiSecret?: string
}

export interface UploadResult {
  url: string
  publicId: string | null
}

let configuredCloudName: string | undefined

function ensureConfigured(config: CloudinaryConfig) {
  if (configuredCloudName === config.cloudName) return
  cloudinary.config({
    cloud_name: config.cloudName,
    api_key: config.apiKey,
    api_secret: config.apiSecret,
    secure: true,
  })
  configuredCloudName = config.cloudName
}

/**
 * Upload une image utilisateur (icône/fond/portrait de DLE custom) : même
 * redimensionnement + encodage webp que le script de migration, pour un
 * rendu cohérent avec le contenu officiel.
 *
 * Sans compte Cloudinary configuré (dev sans secrets), on retombe sur une
 * data URI stockée directement — jamais le cas en prod (secrets toujours
 * renseignés), mais ça permet de tester tout le flux de création en local
 * sans dépendre d'un compte Cloudinary.
 */
export async function uploadUserImage(
  buffer: Buffer,
  folder: string,
  maxDimension: number,
  config: CloudinaryConfig,
): Promise<UploadResult> {
  const resized = await sharp(buffer)
    .resize(maxDimension, maxDimension, { fit: 'inside', withoutEnlargement: true })
    .webp({ quality: 80 })
    .toBuffer()

  const dataUri = `data:image/webp;base64,${resized.toString('base64')}`

  if (!config.cloudName) {
    return { url: dataUri, publicId: null }
  }

  ensureConfigured(config)
  const result = await cloudinary.uploader.upload(dataUri, { folder, timeout: 60000 })
  return { url: result.secure_url, publicId: result.public_id }
}
