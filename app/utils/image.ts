/**
 * Injecte des transformations Cloudinary (format auto WebP/AVIF, qualité
 * auto, largeur cible) dans une secure_url Cloudinary complète. Renvoie
 * l'URL telle quelle si ce n'est pas une URL Cloudinary reconnue (image
 * legacy locale en dev, URL vide, etc.) plutôt que de la casser.
 */
export function cloudinaryUrl(url: string | null | undefined, width?: number): string {
  if (!url) return ''
  const marker = '/image/upload/'
  const idx = url.indexOf(marker)
  if (idx === -1) return url

  const transforms = ['f_auto', 'q_auto', width ? `w_${width}` : null].filter(Boolean).join(',')
  return url.slice(0, idx + marker.length) + transforms + '/' + url.slice(idx + marker.length)
}
