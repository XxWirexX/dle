// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: '2025-07-15',
  devtools: { enabled: true },

  modules: ['@nuxt/image', '@vueuse/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      htmlAttrs: { lang: 'fr' },
      title: 'Jeux de devinettes de personnages',
      titleTemplate: '%s · DLE',
      meta: [
        {
          name: 'description',
          content: 'DLE, le Wordle des personnages : devine un personnage d\'anime, de manga ou d\'une autre série en un minimum d\'essais, seul ou en duo. Crée aussi ton propre DLE personnalisé.',
        },
        { property: 'og:type', content: 'website' },
        { property: 'og:site_name', content: 'DLE' },
        { name: 'theme-color', content: '#0d0d14' },
      ],
      link: [
        { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
        { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossorigin: '' },
        { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap' },
      ],
    },
  },

  typescript: {
    strict: true,
    typeCheck: false, // activé en CI (`nuxt typecheck`), pas au dev pour la vitesse
  },

  // On stocke l'URL Cloudinary complète (secure_url) en DB plutôt qu'un
  // public_id relatif, donc le provider "cloudinary" de @nuxt/image (qui
  // attend un chemin relatif à une baseURL) ne s'applique pas tel quel.
  // <NuxtImg> avec le provider par défaut gère déjà le lazy-loading sur
  // une URL absolue ; les transformations Cloudinary (format/largeur) se
  // font via l'helper `cloudinaryUrl()` quand c'est utile (voir
  // app/utils/image.ts), pas via ce module pour l'instant.

  runtimeConfig: {
    databaseUrl: process.env.DATABASE_URL,
    jwtSecret: process.env.JWT_SECRET,
    smtpHost: process.env.SMTP_HOST,
    smtpPort: process.env.SMTP_PORT,
    smtpUser: process.env.SMTP_USER,
    smtpPass: process.env.SMTP_PASS,
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
    discordClientSecret: process.env.DISCORD_CLIENT_SECRET,
    public: {
      frontendUrl: process.env.FRONTEND_URL || 'http://localhost:3000',
      // Vide = l'Activity Discord reste désactivée (page /activity hors service).
      discordClientId: process.env.DISCORD_CLIENT_ID || '',
    },
  },

  nitro: {
    experimental: {
      websocket: true,
    },
  },
})
