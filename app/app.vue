<script setup lang="ts">
// Canonique posée ici plutôt que page par page : une seule URL "officielle"
// par route (sans query string), évite le contenu dupliqué aux yeux des
// moteurs de recherche quand une page est accessible via plusieurs variantes
// d'URL (paramètres de tracking, etc.).
// useRequestURL() plutôt que runtimeConfig.public.frontendUrl : dérivé de
// la requête réelle (hôte/protocole), donc fiable même si la variable
// d'env n'est pas branchée (son nom attendu par Nitro au runtime, préfixé
// NUXT_PUBLIC_, diffère de celui lu par nuxt.config.ts au moment du build).
// Appelé une fois ici, de façon synchrone : useHead résout `link` plus tard
// dans le cycle de rendu, hors du contexte Nuxt, donc un useRequestURL()
// différé (ex: dans un computed) y échoue.
const origin = useRequestURL().origin
const route = useRoute()
useHead({
  link: [
    { rel: 'canonical', href: computed(() => `${origin}${route.path}`) },
  ],
})
</script>

<template>
  <div>
    <NuxtLoadingIndicator color="var(--accent)" />
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>
  </div>
</template>
