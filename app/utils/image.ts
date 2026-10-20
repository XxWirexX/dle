const CLOUDINARY_HOST = 'https://res.cloudinary.com'
// Doit correspondre au mapping d'URL "/cdn" -> "res.cloudinary.com" configuré
// côté Discord Developer Portal (Activities > URL Mappings).
const DISCORD_ACTIVITY_CDN_PREFIX = '/cdn'

/**
 * Dans l'Activity Discord, le navigateur ne voit que le proxy Discord
 * ({client_id}.discordsays.com) : toute requête vers un host externe non
 * déclaré dans les URL Mappings est bloquée, y compris les images
 * Cloudinary chargées en <img src>. On le détecte au host apparent de la
 * page plutôt qu'un flag applicatif, pour que ça marche même sans passer
 * par la logique de connexion (ex: une image affichée avant tout login).
 */
function isInsideDiscordActivity(): boolean {
  return typeof window !== 'undefined' && window.location.hostname.endsWith('.discordsays.com')
}

/**
 * Injecte des transformations Cloudinary (format auto WebP/AVIF, qualité
 * auto, largeur cible) dans une secure_url Cloudinary complète. Renvoie
 * l'URL telle quelle si ce n'est pas une URL Cloudinary reconnue (image
 * legacy locale en dev, URL vide, etc.) plutôt que de la casser.
 *
 * Dans l'Activity Discord, réécrit aussi le host en chemin relatif
 * (/cdn/...) pour passer par le proxy Discord au lieu d'un appel direct à
 * res.cloudinary.com, qui serait bloqué.
 */
export function cloudinaryUrl(url: string | null | undefined, width?: number): string {
  if (!url) return ''
  const marker = '/image/upload/'
  const idx = url.indexOf(marker)
  if (idx === -1) return url

  const transforms = ['f_auto', 'q_auto', width ? `w_${width}` : null].filter(Boolean).join(',')
  let result = url.slice(0, idx + marker.length) + transforms + '/' + url.slice(idx + marker.length)

  if (isInsideDiscordActivity() && result.startsWith(CLOUDINARY_HOST)) {
    result = DISCORD_ACTIVITY_CDN_PREFIX + result.slice(CLOUDINARY_HOST.length)
  }

  return result
}
