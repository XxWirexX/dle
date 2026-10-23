import { listPublicGames } from '~~/server/db/queries/games'

const STATIC_PATHS = ['/', '/conditions', '/confidentialite']

export default defineEventHandler(async (event) => {
  const origin = getRequestURL(event).origin
  const games = await listPublicGames()

  const urls = [
    ...STATIC_PATHS.map((path) => `${origin}${path}`),
    ...games.map((g) => `${origin}/games/${g.slug}`),
  ]

  const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map((url) => `  <url><loc>${url}</loc></url>`).join('\n')}
</urlset>`

  setResponseHeader(event, 'Content-Type', 'application/xml')
  setResponseHeader(event, 'Cache-Control', 'public, max-age=3600')
  return body
})
